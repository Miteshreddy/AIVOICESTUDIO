"""Joining synthesised chunks and giving the result a "produced" finish.

Raw neural TTS output sounds dry and uneven next to commercial voices mostly
because of what happens *after* the model: chunk joins, loudness, rumble and
harsh sibilance. This module handles that, plus a high-quality speed change.
"""

import shutil
import subprocess
import tempfile
from pathlib import Path

import librosa
import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.signal import butter, sosfilt

FADE_MS = 12
TARGET_LUFS = -18.0  # podcast/voice-over loudness without pushing peaks into the limiter
TRUE_PEAK = 0.89  # ≈ -1 dBFS


def _fade(audio: np.ndarray, sr: int) -> np.ndarray:
    n = min(len(audio) // 2, int(sr * FADE_MS / 1000))
    if n <= 0:
        return audio
    audio = audio.copy()
    ramp = np.linspace(0.0, 1.0, n, dtype=np.float32)
    audio[:n] *= ramp
    audio[-n:] *= ramp[::-1]
    return audio


def trim_chunk(audio: np.ndarray, sr: int) -> np.ndarray:
    """Remove the model's own leading/trailing silence (and the occasional
    trailing breath-noise tail) so *we* control the gap between sentences."""
    if len(audio) == 0:
        return audio
    _, (start, end) = librosa.effects.trim(audio, top_db=40, frame_length=1024, hop_length=256)
    pad = int(sr * 0.04)
    return audio[max(0, start - pad) : min(len(audio), end + pad)]


def join_chunks(chunks: list[tuple[np.ndarray, int]], sr: int) -> np.ndarray:
    """Concatenate (audio, pause_after_ms) pairs with a low "room tone" bed in
    the pauses instead of digital silence — pure zeros between sentences is one
    of the subtle tells of synthetic speech."""
    rng = np.random.default_rng(0)
    out: list[np.ndarray] = []
    for audio, pause_ms in chunks:
        out.append(_fade(trim_chunk(audio, sr), sr))
        if pause_ms > 0:
            n = int(sr * pause_ms / 1000)
            out.append((rng.standard_normal(n) * 1e-4).astype(np.float32))
    return np.concatenate(out) if out else np.zeros(1, dtype=np.float32)


def _deess(audio: np.ndarray, sr: int, amount_db: float = 4.0) -> np.ndarray:
    """Dynamic de-esser: attenuate the 5-9 kHz band only where it dominates."""
    if sr < 16000:
        return audio
    nyq = sr / 2
    sos = butter(2, [5000 / nyq, min(9000, nyq * 0.95) / nyq], btype="band", output="sos")
    band = sosfilt(sos, audio)
    win = max(1, int(sr * 0.005))
    kernel = np.ones(win) / win
    band_env = np.sqrt(np.convolve(band**2, kernel, mode="same"))
    full_env = np.sqrt(np.convolve(audio**2, kernel, mode="same")) + 1e-8
    ratio = band_env / full_env
    reduce = np.clip((ratio - 0.35) / 0.35, 0, 1) * (1 - 10 ** (-amount_db / 20))
    return (audio - band * reduce).astype(np.float32)


def _limit(audio: np.ndarray, sr: int, ceiling: float) -> np.ndarray:
    """Look-ahead peak limiter: smooth gain reduction only where peaks exceed
    the ceiling. Unlike a clipper it adds no distortion."""
    over = np.maximum(1.0, np.abs(audio) / ceiling)
    if over.max() <= 1.0:
        return audio
    win = max(1, int(sr * 0.005))  # 5 ms look-ahead / release
    from scipy.ndimage import maximum_filter1d, uniform_filter1d

    gain = uniform_filter1d(maximum_filter1d(over, size=2 * win + 1), size=2 * win + 1)
    return (audio / np.maximum(gain, 1.0)).astype(np.float32)


def master(audio: np.ndarray, sr: int, deess: bool = True) -> np.ndarray:
    audio = audio.astype(np.float32)
    # Rumble / DC removal.
    sos = butter(2, 70 / (sr / 2), btype="high", output="sos")
    audio = sosfilt(sos, audio).astype(np.float32)
    if deess:
        audio = _deess(audio, sr)

    if len(audio) >= sr * 0.5:
        meter = pyln.Meter(sr, block_size=min(0.4, len(audio) / sr / 2))
        loudness = meter.integrated_loudness(audio)
        if np.isfinite(loudness):
            audio = (audio * 10 ** ((TARGET_LUFS - loudness) / 20)).astype(np.float32)

    audio = _limit(audio, sr, TRUE_PEAK)
    return _fade(audio, sr)


def change_speed(audio: np.ndarray, sr: int, rate: float) -> np.ndarray:
    """Pitch-preserving speed change via ffmpeg's atempo (WSOLA), falling back
    to librosa's phase vocoder if ffmpeg is unavailable."""
    if abs(rate - 1.0) < 0.01:
        return audio
    rate = float(np.clip(rate, 0.5, 2.0))
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        with tempfile.TemporaryDirectory() as tmp:
            src, dst = Path(tmp) / "in.wav", Path(tmp) / "out.wav"
            sf.write(src, audio, sr)
            # atempo (WSOLA) measured best on this material: UTMOS 4.43 vs 4.45
            # untouched at 0.85x, while Rubber Band dropped it to ~2.6.
            for filt in (f"atempo={rate}",):
                result = subprocess.run(
                    [ffmpeg, "-y", "-loglevel", "error", "-i", str(src), "-af", filt, str(dst)],
                    capture_output=True,
                )
                if result.returncode == 0 and dst.exists():
                    out, _ = sf.read(dst, dtype="float32")
                    return out
    return librosa.effects.time_stretch(audio, rate=rate).astype(np.float32)


def _band_gain(audio: np.ndarray, sr: int, low: float, high: float | None, gain_db: float) -> np.ndarray:
    if abs(gain_db) < 0.05:
        return audio
    nyq = sr / 2
    if high is None:
        sos = butter(2, low / nyq, btype="high", output="sos")
    else:
        sos = butter(2, [low / nyq, min(high, nyq * 0.95) / nyq], btype="band", output="sos")
    return (audio + sosfilt(sos, audio) * (10 ** (gain_db / 20) - 1)).astype(np.float32)


def apply_tone(audio: np.ndarray, sr: int, semitones: float, brightness: float, warmth: float) -> np.ndarray:
    """Voice-design controls that are real signal operations, not placebo."""
    semitones = float(np.clip(semitones, -4, 4))
    if abs(semitones) >= 0.1:
        ffmpeg = shutil.which("ffmpeg")
        shifted = None
        if ffmpeg:
            with tempfile.TemporaryDirectory() as tmp:
                src, dst = Path(tmp) / "in.wav", Path(tmp) / "out.wav"
                sf.write(src, audio, sr)
                ratio = 2 ** (semitones / 12)
                r = subprocess.run(
                    [ffmpeg, "-y", "-loglevel", "error", "-i", str(src), "-af",
                     f"rubberband=pitch={ratio}:formant=preserved:pitchq=quality", str(dst)],
                    capture_output=True,
                )
                if r.returncode == 0:
                    shifted, _ = sf.read(dst, dtype="float32")
        audio = shifted if shifted is not None else librosa.effects.pitch_shift(audio, sr=sr, n_steps=semitones)
    audio = _band_gain(audio, sr, 4500, None, float(np.clip(brightness, -1, 1)) * 5)
    audio = _band_gain(audio, sr, 150, 450, float(np.clip(warmth, -1, 1)) * 4)
    return audio.astype(np.float32)


# ── Studio polish ────────────────────────────────────────────────────────────

# Spectral centroid of professional close-mic voice-over (measured on
# ElevenLabs reference narrations: ~1,900-2,100 Hz). Audiobook-derived and
# 24 kHz model output sits far lower and reads as dull/muffled.
TARGET_BRIGHTNESS_HZ = 1950.0


def _centroid(audio: np.ndarray, sr: int) -> float:
    cent = librosa.feature.spectral_centroid(y=audio, sr=sr)[0]
    rms = librosa.feature.rms(y=audio)[0][: len(cent)]
    speech = rms > (rms.max() * 0.05 if len(rms) else 0)
    return float(np.median(cent[speech])) if speech.any() else 0.0


def polish(audio: np.ndarray, sr: int) -> np.ndarray:
    """Adaptive voice-over EQ: clear the mud, lift presence and air until the
    voice reaches studio brightness. Measures first, so already-bright voices
    are left alone and dull ones get exactly the lift they need."""
    if len(audio) < sr // 2:
        return audio
    audio = _band_gain(audio, sr, 200, 450, -2.0)  # boxiness
    current = _centroid(audio, sr)
    if current <= 0:
        return audio
    deficit = TARGET_BRIGHTNESS_HZ - current
    if deficit > 50:
        presence = float(np.clip(deficit / 250, 0.0, 4.0))
        air = float(np.clip(deficit / 160, 0.0, 6.0))
        audio = _band_gain(audio, sr, 2500, 5500, presence)
        audio = _band_gain(audio, sr, 6500, None, air)
    return audio.astype(np.float32)


def natural_pace(audio: np.ndarray, sr: int, words: int, target_wpm: float = 168.0) -> np.ndarray:
    """Slow a passage down if the model rushed it. Neural TTS tends to speak
    faster than a human narrator, and rushed delivery is one of the strongest
    'synthetic' cues. Never speeds up, and never slows more than 20 %."""
    seconds = len(audio) / sr
    if seconds < 1.0 or words < 4:
        return audio
    wpm = words / seconds * 60
    if wpm <= target_wpm * 1.04:
        return audio
    rate = max(0.8, target_wpm / wpm)
    return change_speed(audio, sr, rate)


def cap_silences(
    audio: np.ndarray, sr: int, max_gap: float, keep: float, threshold_db: float = -42.0, tail_share: float = 0.5
) -> np.ndarray:
    """Shorten any quiet stretch longer than max_gap seconds to `keep` seconds.
    The middle is removed (edges stay, so words still decay naturally and
    breaths placed near the next word survive) with a short crossfade."""
    if len(audio) < sr:
        return audio
    hop = int(sr * 0.01)
    rms = librosa.feature.rms(y=audio, frame_length=hop * 4, hop_length=hop)[0]
    if rms.max() <= 0:
        return audio
    quiet = 20 * np.log10(rms / rms.max() + 1e-9) < threshold_db
    # Bridge tiny blips (clicks, faint noise < 60 ms) inside a silence, so one
    # click doesn't split a long gap into two "acceptable" halves.
    from scipy.ndimage import binary_closing

    quiet = binary_closing(quiet, structure=np.ones(7, dtype=bool)) | quiet
    out, pos, run_start = [], 0, None
    fade = int(sr * 0.012)
    for i, q in enumerate(np.append(quiet, False)):
        if q and run_start is None:
            run_start = i
        elif not q and run_start is not None:
            length = (i - run_start) * hop
            if length > max_gap * sr:
                start, end = run_start * hop, i * hop
                keep_n = int(keep * sr)
                tail_n = int(keep_n * tail_share)
                head_end = start + (keep_n - tail_n)
                tail_start = end - tail_n
                head = audio[pos:head_end].copy()
                tail = audio[tail_start:end]
                if len(head) > fade and len(tail) > fade:
                    ramp = np.linspace(1, 0, fade, dtype=np.float32)
                    head[-fade:] = head[-fade:] * ramp + tail[:fade] * (1 - ramp)
                    tail = tail[fade:]
                out.extend([head, tail])
                pos = end
            run_start = None
    out.append(audio[pos:])
    return np.concatenate(out).astype(np.float32)
