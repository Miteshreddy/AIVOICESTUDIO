import io
import json
from contextlib import asynccontextmanager

import soundfile as sf
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

from . import generation_store, models, voice_store
from .audio_processing import Operation, ProcessRequest, process_audio
from .clone_builder import build_reference, decode_any
from .text_normalize import load_pronunciations, save_pronunciations
from .config import HOST, PORT
from .tts_engine import (
    VoiceSettings,
    analyze_audio,
    convert_voice,
    generate_sound_effect,
    synthesize,
    to_wav_bytes,
)

PREVIEW_TEXT = (
    "Hey there! It's really nice to meet you. I can read your stories, scripts and videos — "
    "and honestly, I think we're going to make something great together."
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    models.preload_in_background()
    yield


app = FastAPI(title="KAIZ Studio — Local Voice Engine", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def _duration(audio_bytes: bytes) -> float:
    info = sf.info(io.BytesIO(audio_bytes))
    return round(info.frames / info.samplerate, 2) if info.samplerate else 0.0


def _voice_or_404(voice_id: str) -> dict:
    metadata = voice_store.get_voice_metadata(voice_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="Voice not found")
    return metadata


# ── Health ────────────────────────────────────────────────────────────────────


@app.get("/health")
def health():
    status = models.status()
    tts = status["models"].get("tts", {"status": "idle"})
    return {
        "status": "ok",
        "modelLoaded": tts.get("status") == "ready",
        "model": {"status": tts.get("status"), "error": tts.get("error")},
        **status,
    }


# ── Voices ────────────────────────────────────────────────────────────────────


@app.post("/voices/clone")
async def clone_voice(
    name: str = Form(...),
    description: str = Form(""),
    files: list[UploadFile] = File(...),
):
    payload = [(await f.read(), f.filename or "sample") for f in files]
    try:
        result = await run_in_threadpool(build_reference, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not process audio: {exc}") from exc

    metadata = voice_store.create_voice(
        name,
        description,
        result["reference"],
        tags=["cloned"],
        extra={"transcript": result["transcript"][:2000], "qualityScore": result["qualityScore"]},
    )
    return {
        **metadata,
        "analysis": result["analysis"],
        "qualityScore": result["qualityScore"],
        "warnings": result["warnings"],
        "speechSeconds": result["speechSeconds"],
        "referenceSeconds": result["referenceSeconds"],
    }


@app.get("/voices")
def list_voices():
    from .tts_engine import adapter_path

    return [{**v, "fineTuned": adapter_path(v["id"]) is not None} for v in voice_store.list_voices()]


@app.get("/voices/{voice_id}")
def get_voice(voice_id: str):
    return _voice_or_404(voice_id)


class VoiceUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    speed: float | None = None


@app.patch("/voices/{voice_id}")
def update_voice(voice_id: str, request: VoiceUpdateRequest):
    metadata = voice_store.update_voice(voice_id, request.name, request.description, request.tags, request.speed)
    if not metadata:
        raise HTTPException(status_code=404, detail="Voice not found")
    return metadata


@app.get("/voices/{voice_id}/reference")
async def get_voice_reference(voice_id: str):
    """Preview for a voice: a short sample spoken by the actual engine (with the
    human layer), so "Listen" sounds exactly like what Generate will produce.
    Synthesised once, then cached."""
    _voice_or_404(voice_id)
    preview = voice_store.get_preview_path(voice_id)
    if not preview.exists():
        path = voice_store.get_reference_path(voice_id)
        if not path:
            raise HTTPException(status_code=404, detail="Voice has no reference audio")
        audio = await run_in_threadpool(synthesize, PREVIEW_TEXT, str(path), VoiceSettings(seed=11))
        preview.write_bytes(audio)
    return FileResponse(preview, media_type="audio/wav")


@app.delete("/voices/{voice_id}")
def remove_voice(voice_id: str):
    if not voice_store.delete_voice(voice_id):
        raise HTTPException(status_code=404, detail="Voice not found")
    return {"deleted": voice_id}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    raw = await file.read()
    try:
        audio, sr = decode_any(raw, file.filename or "")
        return analyze_audio(to_wav_bytes(audio, sr))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not read audio file: {exc}") from exc


# ── Text to speech ───────────────────────────────────────────────────────────


class TtsRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20_000)
    voiceId: str
    stability: float = Field(0.5, ge=0, le=1)
    speed: float | None = Field(None, ge=0.5, le=2.0)
    seed: int | None = None
    takes: int = Field(2, ge=1, le=3)
    pitchSemitones: float = Field(0.0, ge=-4, le=4)
    brightness: float = Field(0.0, ge=-1, le=1)
    warmth: float = Field(0.0, ge=-1, le=1)


@app.post("/tts")
async def generate_speech(request: TtsRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="text must not be empty")

    meta = _voice_or_404(request.voiceId)
    path = voice_store.get_reference_path(request.voiceId)
    if not path:
        raise HTTPException(status_code=404, detail="Voice reference audio missing")

    settings = VoiceSettings(
        stability=request.stability,
        speed=request.speed if request.speed is not None else meta.get("speed", 1.0),
        seed=request.seed,
        target_wpm=float(meta.get("paceWpm", 168)),
        takes=request.takes,
        pitch_semitones=request.pitchSemitones,
        brightness=request.brightness,
        warmth=request.warmth,
    )
    try:
        audio = await run_in_threadpool(synthesize, request.text, str(path), settings)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Synthesis failed: {exc}") from exc

    voice_store.increment_generation_count(request.voiceId)
    generation_store.create_generation(request.voiceId, meta["name"], request.text, _duration(audio), audio)
    return Response(content=audio, media_type="audio/wav")


# ── Pronunciation dictionary ─────────────────────────────────────────────────


@app.get("/pronunciations")
def get_pronunciations():
    return load_pronunciations()


@app.put("/pronunciations")
def put_pronunciations(entries: dict[str, str]):
    save_pronunciations(entries)
    return load_pronunciations()


# ── Voice changer (speech-to-speech) ─────────────────────────────────────────


@app.post("/voice-changer")
async def voice_changer(voiceId: str = Form(...), file: UploadFile = File(...), removeNoise: bool = Form(False)):
    meta = _voice_or_404(voiceId)
    target = voice_store.get_reference_path(voiceId)
    if not target or not target.exists():
        raise HTTPException(status_code=404, detail="Voice reference audio missing")

    raw = await file.read()
    try:
        audio, sr = decode_any(raw, file.filename or "")
        if removeNoise:
            from .audio_processing import apply_noise_reduction

            audio = apply_noise_reduction(audio, sr, 70)
        result = await run_in_threadpool(convert_voice, to_wav_bytes(audio, sr), str(target))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Voice conversion failed: {exc}") from exc

    generation_store.create_generation(voiceId, meta["name"], "[Voice changer]", _duration(result), result)
    return Response(content=result, media_type="audio/wav")


# ── Sound effects ─────────────────────────────────────────────────────────────


class SfxRequest(BaseModel):
    prompt: str = Field(min_length=2, max_length=500)
    durationSeconds: float = Field(5.0, ge=1, le=30)
    promptInfluence: float = Field(0.5, ge=0, le=1)
    seed: int | None = None
    quality: str = "standard"  # draft | standard | high


@app.post("/sound-effects")
async def sound_effects(request: SfxRequest):
    steps = {"draft": 50, "standard": 100, "high": 200}.get(request.quality, 100)
    guidance = 2.0 + request.promptInfluence * 5.0
    try:
        audio = await run_in_threadpool(
            generate_sound_effect, request.prompt, request.durationSeconds, steps, guidance, request.seed
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Sound effect generation failed: {exc}") from exc
    generation_store.create_generation(None, "Sound effect", request.prompt, _duration(audio), audio)
    return Response(content=audio, media_type="audio/wav")


# ── Speech to text ────────────────────────────────────────────────────────────


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...), language: str | None = Form(None)):
    raw = await file.read()

    def run():
        import librosa

        audio, sr = decode_any(raw, file.filename or "")
        audio = librosa.resample(audio, orig_sr=sr, target_sr=16000)
        segments, info = models.whisper().transcribe(audio, language=language, vad_filter=True)
        segs = [{"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()} for s in segments]
        return {"language": info.language, "text": " ".join(s["text"] for s in segs), "segments": segs}

    try:
        return await run_in_threadpool(run)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}") from exc


# ── Generation history ───────────────────────────────────────────────────────


@app.get("/generations")
def list_generations():
    return generation_store.list_generations()


@app.get("/generations/{generation_id}/audio")
def get_generation_audio(generation_id: str):
    path = generation_store.get_audio_path(generation_id)
    if not path:
        raise HTTPException(status_code=404, detail="Generation not found")
    return FileResponse(path, media_type="audio/wav", filename=f"{generation_id}.wav")


class GenerationUpdateRequest(BaseModel):
    favorite: bool | None = None
    status: str | None = None


@app.patch("/generations/{generation_id}")
def update_generation(generation_id: str, request: GenerationUpdateRequest):
    metadata = generation_store.update_generation(generation_id, request.favorite, request.status)
    if not metadata:
        raise HTTPException(status_code=404, detail="Generation not found")
    return metadata


@app.delete("/generations/{generation_id}")
def remove_generation(generation_id: str):
    if not generation_store.delete_generation(generation_id):
        raise HTTPException(status_code=404, detail="Generation not found")
    return {"deleted": generation_id}


# ── Audio cleanup ─────────────────────────────────────────────────────────────


class OperationModel(BaseModel):
    enabled: bool = False
    amount: float = 50.0


class AudioProcessOptions(BaseModel):
    noiseRemoval: OperationModel = OperationModel()
    echoRemoval: OperationModel = OperationModel()
    normalize: OperationModel = OperationModel()
    silenceRemoval: OperationModel = OperationModel()
    volumeLeveling: OperationModel = OperationModel()
    aiEnhancement: OperationModel = OperationModel()
    compressor: OperationModel = OperationModel()
    limiter: OperationModel = OperationModel()
    eqPreset: str = "flat"


@app.post("/audio/process")
async def process_audio_endpoint(file: UploadFile = File(...), operations: str = Form(...)):
    try:
        options = AudioProcessOptions.model_validate(json.loads(operations))
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid operations payload: {exc}") from exc

    raw = await file.read()
    request = ProcessRequest(
        noise_removal=Operation(**options.noiseRemoval.model_dump()),
        echo_removal=Operation(**options.echoRemoval.model_dump()),
        normalize=Operation(**options.normalize.model_dump()),
        silence_removal=Operation(**options.silenceRemoval.model_dump()),
        volume_leveling=Operation(**options.volumeLeveling.model_dump()),
        ai_enhancement=Operation(**options.aiEnhancement.model_dump()),
        compressor=Operation(**options.compressor.model_dump()),
        limiter=Operation(**options.limiter.model_dump()),
        eq_preset=options.eqPreset,
    )
    try:
        audio, sr = decode_any(raw, file.filename or "")
        processed = await run_in_threadpool(process_audio, to_wav_bytes(audio, sr), request)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Audio processing failed: {exc}") from exc
    return Response(content=processed, media_type="audio/wav")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT)
