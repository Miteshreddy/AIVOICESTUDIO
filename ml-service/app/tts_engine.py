"""Text-to-speech + voice conversion, fully local.

One speech model: Chatterbox-Turbo (Resemble AI, MIT). Every voice — library
and cloned — is a reference recording of a real person; Turbo reads timbre
and delivery style from it.

What keeps the output from sounding synthetic:
  1. Context: paragraphs are generated as whole chunks (up to ~320 chars), so
     intonation flows across sentences instead of resetting at each full stop.
  2. Retakes: every chunk is length-checked against its text and re-sampled
     if the model mumbled, cut off or looped.
  3. The human layer (humanize.py): the speaker's own room tone under the
     voice and in every pause, their real breaths before new thoughts, and
     pause lengths that vary the way a person's do.
  4. Mastering: de-ess, loudness-normalise, soft-limit.
"""

import io
import random
import threading
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
import torch

from . import humanize, models
from .config import OUTPUT_SR
from .mastering import apply_tone, cap_silences, change_speed, master, natural_pace, polish
from .text_processing import split_into_chunks

_synthesis_lock = threading.Lock()

_CONDS_CACHE_SIZE = 16
_conds_cache: "OrderedDict[str, object]" = OrderedDict()


@dataclass
class VoiceSettings:
    stability: float = 0.5  # 0 = more varied & expressive, 1 = steadier & more consistent
    speed: float = 1.0
    seed: int | None = None
    # Natural speaking rate for this voice. Narration ~165, YouTube ~182.
    target_wpm: float = 168.0
    # Takes generated per passage; the best one is kept (1 = fastest).
    takes: int = 2
    pitch_semitones: float = 0.0  # formant-preserving post shift, ±4 st
    brightness: float = 0.0  # -1..1 high-shelf tilt
    warmth: float = 0.0  # -1..1 low-mid body

    def sampling(self) -> dict:
        # Turbo's own defaults are temperature 0.8 / top_p 0.95. Lower stability
        # lets more natural variation through; higher locks delivery down.
        return {
            "temperature": float(np.interp(self.stability, [0, 1], [0.95, 0.55])),
            "top_p": 0.95,
            "top_k": 1000,
            "repetition_penalty": 1.2,
        }


def _to_numpy(wav) -> np.ndarray:
    if hasattr(wav, "detach"):
        wav = wav.detach().float().cpu().numpy()
    return np.asarray(wav, dtype=np.float32).squeeze()


def _resample(audio: np.ndarray, sr: int) -> np.ndarray:
    if sr == OUTPUT_SR:
        return audio
    return librosa.resample(audio, orig_sr=sr, target_sr=OUTPUT_SR).astype(np.float32)


def _looks_broken(audio: np.ndarray, sr: int, text: str) -> bool:
    """Heuristic hallucination check: typical English speech is ~13-17 chars/s.
    Wildly shorter output = cut-off; wildly longer = babbling/repetition."""
    seconds = len(audio) / sr
    expected = max(0.6, len(text) / 15.0)
    return seconds < expected * 0.45 or seconds > expected * 2.0 + 1.5


def _trim(audio: np.ndarray) -> np.ndarray:
    """Remove the model's own leading/trailing silence so pauses are ours."""
    if len(audio) == 0:
        return audio
    _, (start, end) = librosa.effects.trim(audio, top_db=42, frame_length=1024, hop_length=256)
    pad = int(OUTPUT_SR * 0.03)
    return audio[max(0, start - pad) : min(len(audio), end + pad)]


def _prepare_voice(model, reference_path: str):
    cached = _conds_cache.get(reference_path)
    if cached is None:
        model.prepare_conditionals(reference_path)
        cached = model.conds
        _conds_cache[reference_path] = cached
        if len(_conds_cache) > _CONDS_CACHE_SIZE:
            _conds_cache.popitem(last=False)
    _conds_cache.move_to_end(reference_path)
    model.conds = cached


GOOD_MOS = 4.2
GOOD_SIMILARITY = 0.80


def _take_quality(model, audio: np.ndarray, ref_embedding: np.ndarray | None) -> tuple[float, float]:
    """(naturalness UTMOS ~1-5, voice match cosine ~0.6-0.95)."""
    a16 = librosa.resample(audio, orig_sr=OUTPUT_SR, target_sr=16000)
    with torch.inference_mode():
        mos = float(models.naturalness()(torch.from_numpy(a16).unsqueeze(0).to(models.device()), 16000).item())
    similarity = 0.0
    if ref_embedding is not None:
        emb = model.ve.embeds_from_wavs([a16], sample_rate=16000).mean(axis=0)
        similarity = float(np.dot(emb, ref_embedding) / (np.linalg.norm(emb) * np.linalg.norm(ref_embedding) + 1e-9))
    return mos, similarity


def _score_take(model, audio: np.ndarray, ref_embedding: np.ndarray | None) -> float:
    mos, similarity = _take_quality(model, audio, ref_embedding)
    return mos + 3.0 * similarity


FINETUNE_ROOT = Path("G:/KAIZ_AI/finetune")


def adapter_path(voice_id: str) -> Path | None:
    path = FINETUNE_ROOT / voice_id / "adapter"
    return path if (path / "adapter_config.json").exists() else None


_merged_voice: str | None = None


def _use_voice_adapter(model, voice_id: str):
    """Activate the LoRA adapter for fine-tuned ("Pro") voices and merge it
    into the weights — unmerged LoRA doubles per-token cost (measured 6.9 s vs
    3.7 s per take). Other voices get the plain base model. Returns a context
    manager to wrap generation in."""
    import contextlib

    global _merged_voice
    path = adapter_path(voice_id)
    tfmr = model.t3.tfmr
    try:
        from peft import PeftModel
    except ImportError:
        return contextlib.nullcontext()
    is_peft = isinstance(tfmr, PeftModel)

    if path is None:
        if is_peft and _merged_voice is not None:
            tfmr.unmerge_adapter()
            _merged_voice = None
        return tfmr.disable_adapter() if is_peft else contextlib.nullcontext()

    if _merged_voice == voice_id:
        return contextlib.nullcontext()
    if is_peft and _merged_voice is not None:
        tfmr.unmerge_adapter()
        _merged_voice = None
    if not is_peft:
        model.t3.tfmr = PeftModel.from_pretrained(tfmr, str(path), adapter_name=voice_id).eval()
    elif voice_id not in tfmr.peft_config:
        tfmr.load_adapter(str(path), adapter_name=voice_id)
    model.t3.tfmr.set_adapter(voice_id)
    model.t3.tfmr.merge_adapter()
    _merged_voice = voice_id
    return contextlib.nullcontext()


def _render(chunks, reference_path: str, settings: VoiceSettings) -> list[np.ndarray]:
    model = models.tts()
    _prepare_voice(model, reference_path)
    with _use_voice_adapter(model, Path(reference_path).parent.name):
        return _render_with(model, chunks, settings)


def _render_with(model, chunks, settings: VoiceSettings) -> list[np.ndarray]:
    kwargs = settings.sampling()
    ref_embedding = None
    try:
        ref_embedding = model.conds.t3.speaker_emb.detach().float().cpu().numpy().reshape(-1)
    except AttributeError:
        pass

    out = []
    for chunk in chunks:
        good: list[np.ndarray] = []
        fallback = None
        for attempt in range(max(1, settings.takes) + 2):  # up to 2 extra tries for broken takes
            wav = _to_numpy(model.generate(chunk.text, **kwargs))
            if _looks_broken(wav, model.sr, chunk.text):
                target = len(chunk.text) / 15 * model.sr
                if fallback is None or abs(len(wav) - target) < abs(len(fallback) - target):
                    fallback = wav
                print(f"[tts] discarded broken take {attempt + 1}: {chunk.text[:50]!r}")
                continue
            good.append(cap_silences(_trim(_resample(wav, model.sr)), OUTPUT_SR, max_gap=0.55, keep=0.42, threshold_db=-32.0))
            if len(good) >= settings.takes:
                break
            # Adaptive best-of: a take that's already clearly good is kept, so
            # "Best" only pays for a second take when the first one is weak.
            if settings.takes > 1 and len(good) == 1:
                mos, sim = _take_quality(model, good[0], ref_embedding)
                if mos >= GOOD_MOS and (ref_embedding is None or sim >= GOOD_SIMILARITY):
                    break
        if not good:
            good = [cap_silences(_trim(_resample(fallback, model.sr)), OUTPUT_SR, max_gap=0.55, keep=0.42, threshold_db=-32.0)]
        if len(good) > 1:
            scores = [_score_take(model, g, ref_embedding) for g in good]
            best = good[int(np.argmax(scores))]
        else:
            best = good[0]
        out.append(natural_pace(best, OUTPUT_SR, len(chunk.text.split()), settings.target_wpm))
    return out


def synthesize(text: str, reference_wav_path: str, settings: VoiceSettings | None = None) -> bytes:
    settings = settings or VoiceSettings()
    chunks = split_into_chunks(text)
    if not chunks:
        raise ValueError("Nothing to synthesise")

    ref = Path(reference_wav_path)
    texture = humanize.load_or_analyse(ref.parent, ref)
    seed = settings.seed if settings.seed is not None else random.randrange(2**31)

    with _synthesis_lock, torch.inference_mode():
        torch.manual_seed(seed)
        rendered = _render(chunks, reference_wav_path, settings)

    rng = random.Random(seed)
    plan = []
    for chunk, audio in zip(chunks, rendered):
        # Breathe before a new paragraph, after a long thought, and sometimes
        # between shorter ones — never mechanically every time.
        breathe = chunk.paragraph_end or len(chunk.text) > 160 or rng.random() < 0.4
        # Pauses scale with speaking rate so fast delivery doesn't get slow gaps.
        plan.append((audio, int(max(chunk.pause_after_ms, 380 if breathe else 0) / settings.speed), breathe))

    audio = humanize.assemble(plan, texture, seed)
    # Nothing in the final audio may go quiet for longer than a natural
    # paragraph pause — long gaps read as the voice "stopping".
    # Pauses: the model fills them with soft breath/air noise (~-35..-45 dB),
    # so "no speech" means < -32 dB, not digital silence. Only the middle of a
    # pause is removed — its edges stay, protecting soft word onsets/endings
    # (a -24 dB setting once clipped a softly spoken word; -32 dB keeps them).
    audio = cap_silences(audio, OUTPUT_SR, max_gap=0.85, keep=0.7, threshold_db=-32.0, tail_share=0.7)
    audio = change_speed(audio, OUTPUT_SR, settings.speed) if settings.speed != 1.0 else audio
    audio = apply_tone(audio, OUTPUT_SR, settings.pitch_semitones, settings.brightness, settings.warmth)
    audio = polish(audio, OUTPUT_SR)
    # 24 kHz → 48 kHz: rebuild the high band Turbo can't produce (studio "air").
    try:
        from .superres import OUT_SR, upsample

        audio, sr = upsample(audio, OUTPUT_SR), OUT_SR
    except Exception as exc:  # noqa: BLE001 — never fail a generation over enhancement
        print(f"[tts] super-resolution skipped: {exc}")
        sr = OUTPUT_SR
    audio = master(audio, sr)
    return to_wav_bytes(audio, sr)


def convert_voice(source_bytes: bytes, target_reference_path: str) -> bytes:
    """Speech-to-speech: keep the words/timing/emotion of the source recording,
    swap the timbre to the target voice."""
    source, sr = sf.read(io.BytesIO(source_bytes), dtype="float32", always_2d=False)
    if source.ndim > 1:
        source = source.mean(axis=1)

    import tempfile
    from pathlib import Path

    model = models.chatterbox_vc()
    with _synthesis_lock, torch.inference_mode(), tempfile.TemporaryDirectory() as tmp:
        src_path = Path(tmp) / "source.wav"
        sf.write(src_path, source, sr)
        # Long inputs are converted in ~20 s windows to bound memory.
        window = 20 * sr
        pieces = []
        for start in range(0, len(source), window):
            seg_path = Path(tmp) / f"seg{start}.wav"
            sf.write(seg_path, source[start : start + window], sr)
            wav = model.generate(str(seg_path), target_voice_path=target_reference_path)
            pieces.append(_resample(_to_numpy(wav), model.sr))
    audio = master(np.concatenate(pieces), OUTPUT_SR)
    return to_wav_bytes(audio, OUTPUT_SR)


def generate_sound_effect(prompt: str, duration: float = 5.0, steps: int = 100, guidance: float = 3.5, seed: int | None = None) -> bytes:
    pipe = models.sfx()
    generator = torch.Generator(device=models.device())
    if seed is not None:
        generator.manual_seed(seed)
    with _synthesis_lock, torch.inference_mode():
        result = pipe(
            prompt,
            negative_prompt="low quality, distorted, muffled, noise, static, speech",
            num_inference_steps=int(steps),
            audio_length_in_s=float(np.clip(duration, 1.0, 30.0)),
            guidance_scale=float(guidance),
            num_waveforms_per_prompt=2,
            generator=generator,
        )
    # AudioLDM2 ranks its candidates with CLAP — the first is the best match.
    audio = np.asarray(result.audios[0], dtype=np.float32)
    peak = float(np.max(np.abs(audio))) or 1.0
    audio = audio / peak * 0.89
    return to_wav_bytes(audio, 16000)


def to_wav_bytes(audio: np.ndarray, sr: int) -> bytes:
    buffer = io.BytesIO()
    sf.write(buffer, audio, sr, format="WAV", subtype="PCM_16")
    return buffer.getvalue()


def analyze_audio(audio_bytes: bytes) -> dict:
    data, sample_rate = sf.read(io.BytesIO(audio_bytes), always_2d=False)
    if data.ndim > 1:
        data = data.mean(axis=1)

    duration_seconds = len(data) / sample_rate if sample_rate else 0
    rms = float(np.sqrt(np.mean(np.square(data)))) if len(data) else 0.0
    peak = float(np.max(np.abs(data))) if len(data) else 0.0
    clipping_ratio = float(np.mean(np.abs(data) > 0.99)) if len(data) else 0.0

    # Noise floor = energy of the quietest 10% of 50 ms frames; SNR vs the loudest 50%.
    frame = max(1, int(sample_rate * 0.05))
    frames = [data[i : i + frame] for i in range(0, len(data) - frame, frame)]
    energies = np.sort([float(np.sqrt(np.mean(f**2))) + 1e-9 for f in frames]) if frames else np.array([1e-9])
    noise_floor = float(np.mean(energies[: max(1, len(energies) // 10)]))
    speech_level = float(np.mean(energies[len(energies) // 2 :])) if len(energies) > 1 else noise_floor
    snr_db = 20 * np.log10(speech_level / noise_floor) if noise_floor > 0 else 60.0

    clarity_score = int(np.clip((snr_db - 10) / 30 * 100, 0, 100))
    noise_level = int(np.clip(100 - clarity_score + clipping_ratio * 500, 0, 100))

    return {
        "durationSeconds": round(duration_seconds, 2),
        "sampleRate": sample_rate,
        "clarityScore": clarity_score,
        "noiseLevel": noise_level,
        "snrDb": round(float(snr_db), 1),
        "peakAmplitude": round(peak, 4),
        "clippingDetected": clipping_ratio > 0.001,
    }
