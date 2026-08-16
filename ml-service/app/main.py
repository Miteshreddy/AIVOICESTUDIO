import io
import json
from contextlib import asynccontextmanager

import soundfile as sf
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from . import generation_store, voice_store
from .audio_processing import Operation, ProcessRequest, apply_time_stretch, prepare_clone_reference, process_audio
from .config import HOST, PORT
from .tts_engine import analyze_audio, get_model_status, preload_model_in_background, synthesize


@asynccontextmanager
async def lifespan(_app: FastAPI):
    preload_model_in_background()
    yield


app = FastAPI(title="Voice Studio AI — Local TTS Engine", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _measure_duration_seconds(audio_bytes: bytes) -> float:
    info = sf.info(io.BytesIO(audio_bytes))
    return round(info.frames / info.samplerate, 2) if info.samplerate else 0.0


@app.get("/health")
def health():
    model = get_model_status()
    return {"status": "ok", "modelLoaded": model["status"] == "ready", "model": model}


@app.post("/voices/clone")
async def clone_voice(
    name: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
):
    audio_bytes = await file.read()
    try:
        analysis = analyze_audio(audio_bytes)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not read audio file: {exc}") from exc

    if analysis["durationSeconds"] < 3:
        raise HTTPException(status_code=400, detail="Reference sample must be at least 3 seconds long.")

    try:
        cleaned_bytes = prepare_clone_reference(audio_bytes, analysis["noiseLevel"])
    except Exception:  # noqa: BLE001
        cleaned_bytes = audio_bytes  # fall back to the raw upload rather than fail the clone

    metadata = voice_store.create_voice(name, description, cleaned_bytes)
    return {**metadata, "analysis": analysis}


@app.get("/voices")
def list_voices():
    return voice_store.list_voices()


@app.get("/voices/{voice_id}")
def get_voice(voice_id: str):
    metadata = voice_store.get_voice_metadata(voice_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="Voice not found")
    return metadata


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
def get_voice_reference(voice_id: str):
    metadata = voice_store.get_voice_metadata(voice_id)
    path = voice_store.get_reference_path(voice_id)
    if not metadata or not path:
        raise HTTPException(status_code=404, detail="Voice not found")

    speed = metadata.get("speed", 1.0)
    if speed == 1.0:
        return FileResponse(path, media_type="audio/wav", filename=f"{voice_id}-reference.wav")

    # Preview should sound like what generation actually produces for this voice.
    audio_bytes = apply_time_stretch(path.read_bytes(), speed)
    return Response(
        content=audio_bytes,
        media_type="audio/wav",
        headers={"Content-Disposition": f'inline; filename="{voice_id}-reference.wav"'},
    )


@app.delete("/voices/{voice_id}")
def remove_voice(voice_id: str):
    if not voice_store.delete_voice(voice_id):
        raise HTTPException(status_code=404, detail="Voice not found")
    return {"deleted": voice_id}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    audio_bytes = await file.read()
    try:
        return analyze_audio(audio_bytes)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not read audio file: {exc}") from exc


class TtsRequest(BaseModel):
    text: str
    voiceId: str | None = None
    # Chatterbox's own defaults (0.5 / 0.5 / 0.8) bias toward variety over clarity —
    # higher temperature in particular means more sampling randomness, which reads as
    # mushier articulation. These defaults trade a little expressiveness for
    # noticeably crisper, more consistent pronunciation.
    exaggeration: float = 0.45
    cfgWeight: float = 0.6
    temperature: float = 0.6


@app.post("/tts")
def generate_speech(request: TtsRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="text must not be empty")

    reference_path = None
    speed = 1.0
    if request.voiceId:
        metadata = voice_store.get_voice_metadata(request.voiceId)
        if not metadata:
            raise HTTPException(status_code=404, detail="Voice not found")
        path = voice_store.get_reference_path(request.voiceId)
        if not path:
            raise HTTPException(status_code=404, detail="Voice not found")
        reference_path = str(path)
        speed = metadata.get("speed", 1.0)

    try:
        audio_bytes = synthesize(
            request.text,
            reference_path,
            exaggeration=request.exaggeration,
            cfg_weight=request.cfgWeight,
            temperature=request.temperature,
        )
        if speed != 1.0:
            audio_bytes = apply_time_stretch(audio_bytes, speed)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Synthesis failed: {exc}") from exc

    voice_name = "Default voice"
    if request.voiceId:
        voice_store.increment_generation_count(request.voiceId)
        voice_meta = voice_store.get_voice_metadata(request.voiceId)
        if voice_meta:
            voice_name = voice_meta["name"]

    duration_seconds = _measure_duration_seconds(audio_bytes)
    generation_store.create_generation(request.voiceId, voice_name, request.text, duration_seconds, audio_bytes)

    return Response(content=audio_bytes, media_type="audio/wav")


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

    audio_bytes = await file.read()
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
        processed = process_audio(audio_bytes, request)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Audio processing failed: {exc}") from exc

    return Response(content=processed, media_type="audio/wav")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=HOST, port=PORT)
