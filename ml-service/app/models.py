"""Lazy loader for every local model, with simple VRAM management.

An 8 GB laptop GPU can't hold the TTS model + AudioLDM2 + the voice
converter at once, so "heavy" models are evicted least-recently-used when a
new one is loaded. Small models (Whisper) stay resident.
"""

import gc
import threading
import time
from collections import OrderedDict
from typing import Callable

import torch

from .config import DEVICE, MAX_RESIDENT_MODELS, SFX_MODEL_ID

_lock = threading.RLock()
_heavy: "OrderedDict[str, object]" = OrderedDict()
_light: dict[str, object] = {}
_status: dict[str, dict] = {}


def device() -> str:
    if DEVICE == "cuda" and not torch.cuda.is_available():
        return "cpu"
    return DEVICE


def _set_status(name: str, state: str, error: str | None = None):
    _status[name] = {"status": state, "error": error, "updatedAt": time.time()}


def status() -> dict:
    return {
        "device": device(),
        "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "models": dict(_status),
    }


def _free_gpu():
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


def _get(name: str, loader: Callable[[], object], heavy: bool):
    with _lock:
        store = _heavy if heavy else _light
        if name in store:
            if heavy:
                _heavy.move_to_end(name)
            return store[name]

        if heavy:
            while len(_heavy) >= MAX_RESIDENT_MODELS:
                evicted, _ = _heavy.popitem(last=False)
                _set_status(evicted, "idle")
                print(f"[models] Unloaded {evicted} to free GPU memory")
            _free_gpu()

        _set_status(name, "loading")
        print(f"[models] Loading {name} on {device()} …")
        try:
            model = loader()
        except Exception as exc:  # noqa: BLE001
            _set_status(name, "error", str(exc))
            raise
        store[name] = model
        _set_status(name, "ready")
        print(f"[models] {name} ready")
        return model


def tts():
    """Chatterbox-Turbo: the only speech model. 350M params, ~4 GB VRAM."""

    def load():
        from chatterbox.tts_turbo import ChatterboxTurboTTS

        return ChatterboxTurboTTS.from_pretrained(device=device())

    return _get("tts", load, heavy=True)


def chatterbox_vc():
    def load():
        from chatterbox.vc import ChatterboxVC

        return ChatterboxVC.from_pretrained(device=device())

    return _get("voice-changer", load, heavy=True)


def whisper():
    def load():
        from faster_whisper import WhisperModel

        if device() == "cuda":
            return WhisperModel("small", device="cuda", compute_type="int8_float16")
        return WhisperModel("small", device="cpu", compute_type="int8")

    return _get("whisper", load, heavy=False)


def naturalness():
    """UTMOS22 — neural predictor of how natural speech sounds (MOS 1-5).
    Small (~100 MB); used to pick the best of several takes."""

    def load():
        m = torch.hub.load("tarepan/SpeechMOS:v1.2.0", "utmos22_strong", trust_repo=True)
        return m.eval().to(device())

    return _get("naturalness", load, heavy=False)


def sfx():
    def load():
        from diffusers import AudioLDM2Pipeline

        dtype = torch.float16 if device() == "cuda" else torch.float32
        pipe = AudioLDM2Pipeline.from_pretrained(SFX_MODEL_ID, torch_dtype=dtype)
        return pipe.to(device())

    return _get("sound-effects", load, heavy=True)


def preload_in_background():
    """Warm up the main TTS model at startup so the first click isn't a cold load."""

    def run():
        for loader in (tts,):
            try:
                loader()
            except Exception as exc:  # noqa: BLE001
                print(f"[models] Preload failed: {exc}")

    threading.Thread(target=run, daemon=True).start()
