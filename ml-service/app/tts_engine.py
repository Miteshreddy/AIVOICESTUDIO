import io
import threading
from collections import OrderedDict

import numpy as np
import soundfile as sf
import torch

from .config import DEVICE

_model = None
_model_lock = threading.Lock()
_model_status = "idle"  # idle | loading | ready | error
_model_error: str | None = None

# Chatterbox re-encodes the reference clip from scratch on every generate()
# call unless we hand it already-prepared conditionals. Since library voices
# now use ~15-20s references (up from ~5s) for better clone fidelity, that
# re-encode is no longer cheap — cache the prepared conditionals per
# reference path so repeat generations against the same voice skip it.
_CONDS_CACHE_SIZE = 12
_conds_cache: "OrderedDict[str, object]" = OrderedDict()
_synthesis_lock = threading.Lock()


def _resolve_device() -> str:
    if DEVICE == "cuda" and not torch.cuda.is_available():
        print("[tts_engine] CUDA requested but not available — falling back to CPU (this will be slow).")
        return "cpu"
    return DEVICE


def get_model_status() -> dict:
    return {"status": _model_status, "error": _model_error}


def get_model():
    global _model, _model_status, _model_error
    if _model is None:
        with _model_lock:
            if _model is None:
                _model_status = "loading"
                from chatterbox.tts import ChatterboxTTS

                device = _resolve_device()
                print(f"[tts_engine] Loading Chatterbox TTS on device={device} …")
                try:
                    _model = ChatterboxTTS.from_pretrained(device=device)
                except Exception as exc:  # noqa: BLE001
                    _model_status = "error"
                    _model_error = str(exc)
                    raise
                _model_status = "ready"
                print("[tts_engine] Model loaded.")
    return _model


def preload_model_in_background():
    """Kick off model loading immediately at service startup instead of on the
    first request, so a user's first click never eats a 30-60s cold-load wait."""

    def _load():
        try:
            get_model()
        except Exception as exc:  # noqa: BLE001
            print(f"[tts_engine] Background model preload failed: {exc}")

    threading.Thread(target=_load, daemon=True).start()


def synthesize(
    text: str,
    reference_wav_path: str | None,
    exaggeration: float = 0.5,
    cfg_weight: float = 0.5,
    temperature: float = 0.8,
) -> bytes:
    model = get_model()

    with _synthesis_lock:
        kwargs = dict(exaggeration=exaggeration, cfg_weight=cfg_weight, temperature=temperature)
        if reference_wav_path:
            cached = _conds_cache.get(reference_wav_path)
            if cached is not None:
                # Reuse the already-encoded conditionals — generate() still applies
                # the requested exaggeration on top of cached conds (cheap tensor op).
                model.conds = cached
                _conds_cache.move_to_end(reference_wav_path)
            else:
                model.prepare_conditionals(reference_wav_path, exaggeration=exaggeration)
                _conds_cache[reference_wav_path] = model.conds
                _conds_cache.move_to_end(reference_wav_path)
                if len(_conds_cache) > _CONDS_CACHE_SIZE:
                    _conds_cache.popitem(last=False)

        wav = model.generate(text, **kwargs)

        wav_np = wav.squeeze(0).cpu().numpy() if hasattr(wav, "cpu") else np.asarray(wav)

        buffer = io.BytesIO()
        sf.write(buffer, wav_np, model.sr, format="WAV")
        return buffer.getvalue()


def analyze_audio(audio_bytes: bytes) -> dict:
    data, sample_rate = sf.read(io.BytesIO(audio_bytes), always_2d=False)
    if data.ndim > 1:
        data = data.mean(axis=1)

    duration_seconds = len(data) / sample_rate if sample_rate else 0
    rms = float(np.sqrt(np.mean(np.square(data)))) if len(data) else 0.0
    peak = float(np.max(np.abs(data))) if len(data) else 0.0
    clipping_ratio = float(np.mean(np.abs(data) > 0.99)) if len(data) else 0.0

    silence_threshold = max(rms * 0.1, 1e-4)
    silence_ratio = float(np.mean(np.abs(data) < silence_threshold)) if len(data) else 1.0

    # Coarse, DSP-based heuristics (not a trained noise/clarity model) — good enough to
    # surface actionable warnings without pretending to be a lab-grade audio analyzer.
    clarity_score = max(0, min(100, round(100 * min(1.0, rms / 0.08))))
    noise_level = max(0, min(100, round(100 * silence_ratio * 0.4 + clipping_ratio * 200)))

    return {
        "durationSeconds": round(duration_seconds, 2),
        "sampleRate": sample_rate,
        "clarityScore": clarity_score,
        "noiseLevel": noise_level,
        "peakAmplitude": round(peak, 4),
        "clippingDetected": clipping_ratio > 0.001,
    }
