import io
from dataclasses import dataclass, field

import librosa
import noisereduce as nr
import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.signal import butter, sosfilt


@dataclass
class Operation:
    enabled: bool = False
    amount: float = 50.0  # 0-100


@dataclass
class ProcessRequest:
    noise_removal: Operation = field(default_factory=Operation)
    echo_removal: Operation = field(default_factory=Operation)
    normalize: Operation = field(default_factory=Operation)
    silence_removal: Operation = field(default_factory=Operation)
    volume_leveling: Operation = field(default_factory=Operation)
    ai_enhancement: Operation = field(default_factory=Operation)
    compressor: Operation = field(default_factory=Operation)
    limiter: Operation = field(default_factory=Operation)
    eq_preset: str = "flat"


def _shelf_or_peak(data: np.ndarray, sr: int, freq: float, gain_db: float, kind: str = "peak", q: float = 0.9):
    """Apply a simple 2nd-order peaking/shelf-like filter via bandpass gain blending."""
    if gain_db == 0:
        return data
    nyq = sr / 2
    freq = min(freq, nyq * 0.95)
    low = max(freq / (2**q), 20) / nyq
    high = min(freq * (2**q), nyq * 0.98) / nyq
    if low >= high:
        return data
    sos = butter(2, [low, high], btype="band", output="sos")
    band = sosfilt(sos, data)
    gain_linear = 10 ** (gain_db / 20) - 1
    return data + band * gain_linear


EQ_PRESETS = {
    "flat": [],
    "warm": [(250, 3.5), (8000, -2.0)],
    "bright": [(6000, 4.0), (200, -1.5)],
    "podcast": [(150, -3.0), (3000, 2.5), (9000, 1.0)],
    "bass-boost": [(90, 6.0)],
    "telephone": [(300, -8.0), (3000, -8.0)],
    "vintage-radio": [(200, 3.0), (5000, -6.0), (8000, -10.0)],
    "de-ess": [(6500, -6.0)],
}


def apply_eq(data: np.ndarray, sr: int, preset: str) -> np.ndarray:
    bands = EQ_PRESETS.get(preset, [])
    out = data
    for freq, gain_db in bands:
        out = _shelf_or_peak(out, sr, freq, gain_db)
    peak = np.max(np.abs(out)) if len(out) else 0
    if peak > 0.98:
        out = out / peak * 0.98
    return out.astype(np.float32)


def apply_pitch_shift(data: np.ndarray, sr: int, semitones: float) -> np.ndarray:
    if semitones == 0:
        return data
    shifted = librosa.effects.pitch_shift(data, sr=sr, n_steps=semitones)
    peak = np.max(np.abs(shifted)) if len(shifted) else 0
    if peak > 0.98:
        shifted = shifted / peak * 0.98
    return shifted.astype(np.float32)


def apply_noise_reduction(data: np.ndarray, sr: int, amount: float) -> np.ndarray:
    prop = max(0.05, min(1.0, amount / 100))
    return nr.reduce_noise(y=data, sr=sr, prop_decrease=prop, stationary=True).astype(np.float32)


def apply_echo_reduction(data: np.ndarray, sr: int, amount: float) -> np.ndarray:
    # Echo/room-tail reduction approximated as time-varying spectral gating —
    # a real dereverberation model is out of scope, but this measurably tightens tails.
    prop = max(0.05, min(0.8, amount / 100))
    return nr.reduce_noise(y=data, sr=sr, prop_decrease=prop, stationary=False).astype(np.float32)


def apply_compressor(data: np.ndarray, amount: float) -> np.ndarray:
    threshold = 10 ** (-(10 + amount * 0.25) / 20)  # lower threshold as amount increases
    ratio = 1 + amount / 25  # up to 5:1
    out = np.copy(data)
    abs_out = np.abs(out)
    over = abs_out > threshold
    gain_reduction = np.ones_like(out)
    gain_reduction[over] = (threshold + (abs_out[over] - threshold) / ratio) / abs_out[over]
    return (out * gain_reduction).astype(np.float32)


def apply_limiter(data: np.ndarray, amount: float) -> np.ndarray:
    ceiling = 1.0 - (amount / 100) * 0.3  # amount=100 -> ceiling 0.7
    peak = np.max(np.abs(data)) if len(data) else 0
    if peak <= ceiling or peak == 0:
        return data
    return (data / peak * ceiling).astype(np.float32)


def apply_volume_leveling(data: np.ndarray, sr: int, amount: float) -> np.ndarray:
    window = max(1, int(sr * 0.5))
    strength = amount / 100
    out = np.copy(data)
    target_rms = np.sqrt(np.mean(data**2)) if len(data) else 0
    if target_rms == 0:
        return out
    for start in range(0, len(out), window):
        chunk = out[start : start + window]
        chunk_rms = np.sqrt(np.mean(chunk**2))
        if chunk_rms > 1e-4:
            gain = (target_rms / chunk_rms - 1) * strength + 1
            gain = float(np.clip(gain, 0.3, 3.0))
            out[start : start + window] = chunk * gain
    peak = np.max(np.abs(out)) if len(out) else 0
    if peak > 0.98:
        out = out / peak * 0.98
    return out.astype(np.float32)


def apply_normalize(data: np.ndarray, sr: int, amount: float) -> np.ndarray:
    if len(data) < sr:  # pyloudnorm needs enough samples for a stable measurement
        peak = np.max(np.abs(data)) if len(data) else 0
        return data if peak == 0 else (data / peak * 0.9).astype(np.float32)
    meter = pyln.Meter(sr)
    loudness = meter.integrated_loudness(data)
    if loudness == float("-inf"):
        return data
    target_lufs = -30 + (amount / 100) * 16  # amount=0 -> -30 LUFS, amount=100 -> -14 LUFS
    out = pyln.normalize.loudness(data, loudness, target_lufs)
    peak = np.max(np.abs(out)) if len(out) else 0
    if peak > 0.98:
        out = out / peak * 0.98
    return out.astype(np.float32)


def apply_silence_trim(data: np.ndarray, sr: int, amount: float) -> np.ndarray:
    top_db = 60 - (amount / 100) * 40  # amount=0 -> top_db=60 (barely trims), amount=100 -> top_db=20 (aggressive)
    trimmed, _ = librosa.effects.trim(data, top_db=top_db)
    return trimmed.astype(np.float32) if len(trimmed) > sr * 0.1 else data


def apply_ai_enhancement(data: np.ndarray, sr: int, amount: float) -> np.ndarray:
    """Combined restoration pass: noise reduction + presence EQ + gentle normalize.
    Not a distinct neural model — real classical DSP restoration, described honestly."""
    out = apply_noise_reduction(data, sr, amount * 0.7)
    out = apply_eq(out, sr, "podcast")
    out = apply_normalize(out, sr, 60)
    return out


def apply_time_stretch(audio_bytes: bytes, rate: float) -> bytes:
    """Pitch-preserving speed change. Chatterbox exposes no direct speaking-rate
    control, so this is the real mechanism behind "fast-paced" voices — rate=1.2
    plays 20% faster without changing pitch.

    The phase vocoder used for the stretch measurably drops perceived loudness
    as a side effect, so this restores the pre-stretch loudness afterward —
    otherwise "fast" quietly undoes "loud and clear"."""
    if rate == 1.0:
        return audio_bytes
    data, sr = sf.read(io.BytesIO(audio_bytes), always_2d=False)
    if data.ndim > 1:
        data = data.mean(axis=1)
    data = data.astype(np.float32)

    original_loudness = None
    if len(data) >= sr:
        meter = pyln.Meter(sr)
        loudness = meter.integrated_loudness(data)
        original_loudness = loudness if loudness != float("-inf") else None

    stretched = librosa.effects.time_stretch(data, rate=rate)

    if original_loudness is not None and len(stretched) >= sr:
        meter = pyln.Meter(sr)
        stretched_loudness = meter.integrated_loudness(stretched)
        if stretched_loudness != float("-inf"):
            stretched = pyln.normalize.loudness(stretched, stretched_loudness, original_loudness)

    peak = np.max(np.abs(stretched)) if len(stretched) else 0
    if peak > 0.98:
        stretched = stretched / peak * 0.98

    buffer = io.BytesIO()
    sf.write(buffer, stretched.astype(np.float32), sr, format="WAV")
    return buffer.getvalue()


def prepare_clone_reference(audio_bytes: bytes, noise_level: float) -> bytes:
    """Clean up a user-uploaded voice sample before it's used as a zero-shot TTS
    reference. Library voices (VCTK) are already studio-clean and only get a
    silence-trim; user uploads are far more variable (phone mics, room noise,
    inconsistent gain), so they get denoising + loudness normalization too —
    this is what most directly determines how good a clone actually sounds."""
    data, sr = sf.read(io.BytesIO(audio_bytes), always_2d=False)
    if data.ndim > 1:
        data = data.mean(axis=1)
    data = data.astype(np.float32)

    if noise_level > 25:
        data = apply_noise_reduction(data, sr, min(70, noise_level * 1.5))

    data = apply_silence_trim(data, sr, amount=62)  # ~top_db 35, matches library trim
    data = apply_normalize(data, sr, amount=60)  # ~-20 LUFS, consistent speech level

    buffer = io.BytesIO()
    sf.write(buffer, data, sr, format="WAV")
    return buffer.getvalue()


def process_audio(audio_bytes: bytes, request: ProcessRequest) -> bytes:
    data, sr = sf.read(io.BytesIO(audio_bytes), always_2d=False)
    if data.ndim > 1:
        data = data.mean(axis=1)
    data = data.astype(np.float32)

    if request.noise_removal.enabled:
        data = apply_noise_reduction(data, sr, request.noise_removal.amount)
    if request.echo_removal.enabled:
        data = apply_echo_reduction(data, sr, request.echo_removal.amount)
    if request.eq_preset and request.eq_preset != "flat":
        data = apply_eq(data, sr, request.eq_preset)
    if request.compressor.enabled:
        data = apply_compressor(data, request.compressor.amount)
    if request.limiter.enabled:
        data = apply_limiter(data, request.limiter.amount)
    if request.ai_enhancement.enabled:
        data = apply_ai_enhancement(data, sr, request.ai_enhancement.amount)
    if request.volume_leveling.enabled:
        data = apply_volume_leveling(data, sr, request.volume_leveling.amount)
    if request.normalize.enabled:
        data = apply_normalize(data, sr, request.normalize.amount)
    if request.silence_removal.enabled:
        data = apply_silence_trim(data, sr, request.silence_removal.amount)

    buffer = io.BytesIO()
    sf.write(buffer, data, sr, format="WAV")
    return buffer.getvalue()
