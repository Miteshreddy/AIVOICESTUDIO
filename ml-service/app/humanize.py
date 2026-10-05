"""The "human layer": everything that happens between and around the words.

A neural voice can pronounce every word perfectly and still sound synthetic,
because the tells are elsewhere:

  * digital silence between sentences (real rooms are never silent)
  * pauses of identical length (people never pause the same way twice)
  * no breathing (everyone breathes before a new thought)

So for each voice we analyse its own reference recording once, and keep:

  * room tone — the speaker's actual background noise, looped seamlessly
  * breaths  — the speaker's real inhalations, cut out of the recording

and assemble generated speech with them, the way an audio editor would
edit a real voice-over session.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

SR = 24000
FRAME = 480  # 20 ms
HOP = 240  # 10 ms


@dataclass
class VoiceTexture:
    room_tone: np.ndarray  # a few seconds of the speaker's background noise
    breaths: list[np.ndarray] = field(default_factory=list)


def _frame_db(audio: np.ndarray) -> np.ndarray:
    rms = librosa.feature.rms(y=audio, frame_length=FRAME, hop_length=HOP)[0]
    return 20 * np.log10(rms + 1e-9)


def _segments(mask: np.ndarray) -> list[tuple[int, int]]:
    """Contiguous True runs in a frame mask, as (start_frame, end_frame)."""
    out, start = [], None
    for i, m in enumerate(mask):
        if m and start is None:
            start = i
        elif not m and start is not None:
            out.append((start, i))
            start = None
    if start is not None:
        out.append((start, len(mask)))
    return out


def _fade(x: np.ndarray, ms: float) -> np.ndarray:
    n = min(len(x) // 2, int(SR * ms / 1000))
    if n <= 0:
        return x
    x = x.copy()
    ramp = np.sin(np.linspace(0, np.pi / 2, n)) ** 2
    x[:n] *= ramp
    x[-n:] *= ramp[::-1]
    return x


def synth_breaths(reference: np.ndarray, count: int = 4, seed: int = 0) -> list[np.ndarray]:
    """Fallback inhales for recordings with no usable breaths (e.g. restored
    audiobook data). An inhale is turbulent air through an open vocal tract:
    band-limited noise with one broad resonance, swelling then cutting off.
    Formant and level are matched to the speaker so it sits under the voice."""
    from scipy.signal import butter, sosfilt

    rng = np.random.default_rng(seed)
    f0, voiced, _ = librosa.pyin(reference[: SR * 8], fmin=60, fmax=420, sr=SR, frame_length=1024)
    f0 = f0[voiced & ~np.isnan(f0)] if f0 is not None else np.array([])
    pitch = float(np.median(f0)) if len(f0) else 150.0
    formant = 1100 + (pitch - 110) * 4  # deeper voices → darker breath
    speech_rms = float(np.sqrt(np.mean(reference[np.abs(reference) > 0.02] ** 2))) if np.any(np.abs(reference) > 0.02) else 0.05

    out = []
    for _ in range(count):
        dur = rng.uniform(0.28, 0.46)
        n = int(SR * dur)
        noise = rng.standard_normal(n).astype(np.float32)
        body = sosfilt(butter(2, [300 / (SR / 2), 4200 / (SR / 2)], btype="band", output="sos"), noise)
        f = formant * rng.uniform(0.9, 1.1)
        res = sosfilt(butter(2, [f * 0.75 / (SR / 2), f * 1.35 / (SR / 2)], btype="band", output="sos"), noise)
        breath = 0.6 * body + 1.4 * res
        t = np.linspace(0, 1, n)
        peak = rng.uniform(0.6, 0.75)  # swell, then a quick cut-off
        env = np.where(t < peak, np.sin(np.pi / 2 * t / peak) ** 2, np.cos(np.pi / 2 * (t - peak) / (1 - peak)) ** 1.5)
        breath = breath * env
        breath = breath / (np.sqrt(np.mean(breath**2)) + 1e-9) * speech_rms * 0.05  # ~ -26 dB under the voice
        out.append(_fade(breath.astype(np.float32), 20))
    return out


def analyse(reference: np.ndarray) -> VoiceTexture:
    """Extract room tone and breaths from a voice's reference recording."""
    audio = reference.astype(np.float32)
    db = _frame_db(audio)
    speech_db = np.percentile(db, 90)
    floor_db = np.percentile(db, 10)

    # ── Room tone: the quietest stretches, if they're real noise (not zeros). ──
    # Only genuine background noise qualifies: quiet AND noise-like. In
    # restored/denoised recordings the "quietest" frames are really the
    # fading tails of words — looping those adds a murmur, so they're rejected.
    flat_all = librosa.feature.spectral_flatness(y=audio, n_fft=FRAME, hop_length=HOP)[0]
    m = min(len(db), len(flat_all))
    quiet = (db[:m] < floor_db + 3) & (db[:m] < -50) & (flat_all[:m] > 0.25)
    tone_parts = []
    for a, b in _segments(quiet):
        if (b - a) * HOP >= SR * 0.12:
            seg = audio[a * HOP : b * HOP]
            if np.sqrt(np.mean(seg**2)) > 1e-5:  # digital silence is useless
                tone_parts.append(_fade(seg, 15))
    room_tone = np.concatenate(tone_parts) if tone_parts else np.zeros(0, np.float32)

    # ── Breaths: short, mid-level, noisy (unvoiced) events between phrases. ──
    breaths = []
    if speech_db - floor_db > 25:  # needs a clean recording to find them
        flatness = librosa.feature.spectral_flatness(y=audio, n_fft=FRAME, hop_length=HOP)[0]
        centroid = librosa.feature.spectral_centroid(y=audio, sr=SR, n_fft=FRAME, hop_length=HOP)[0]
        n = min(len(db), len(flatness), len(centroid))
        db, flatness, centroid = db[:n], flatness[:n], centroid[:n]
        candidate = (
            (db > floor_db + 8)
            & (db < speech_db - 14)
            & (flatness > 0.08)  # noise-like, not a vowel
            & (centroid > 900)
            & (centroid < 5000)  # breathy band, not sibilance
        )
        for a, b in _segments(candidate):
            dur = (b - a) * HOP / SR
            if not 0.18 <= dur <= 0.7:
                continue
            # A breath sits between phrases: quieter audio right before it.
            before = db[max(0, a - 15) : a]
            if len(before) and np.min(before) > floor_db + 10:
                continue
            seg = audio[a * HOP : b * HOP]
            breaths.append(_fade(seg, 40))
    breaths.sort(key=len, reverse=True)
    if not breaths:
        breaths = synth_breaths(audio)
    return VoiceTexture(room_tone=room_tone, breaths=breaths[:6])


def save(texture: VoiceTexture, folder: Path) -> None:
    if len(texture.room_tone):
        sf.write(folder / "room_tone.wav", texture.room_tone, SR)
    for i, b in enumerate(texture.breaths):
        sf.write(folder / f"breath_{i}.wav", b, SR)
    (folder / "texture.json").write_text(json.dumps({"breaths": len(texture.breaths)}))


def load(folder: Path) -> VoiceTexture | None:
    if not (folder / "texture.json").exists():
        return None
    tone_path = folder / "room_tone.wav"
    tone = sf.read(tone_path, dtype="float32")[0] if tone_path.exists() else np.zeros(0, np.float32)
    breaths = [sf.read(p, dtype="float32")[0] for p in sorted(folder.glob("breath_*.wav"))]
    return VoiceTexture(room_tone=tone, breaths=breaths)


def load_or_analyse(folder: Path, reference_path: Path) -> VoiceTexture:
    texture = load(folder)
    if texture is None:
        audio, sr = librosa.load(reference_path, sr=SR)
        texture = analyse(audio)
        save(texture, folder)
    return texture


# ── Assembly ──────────────────────────────────────────────────────────────────


def _bed(texture: VoiceTexture, n: int, rng: np.random.Generator) -> np.ndarray:
    """n samples of the speaker's room tone (or near-silent noise as fallback)."""
    tone = texture.room_tone
    if len(tone) < SR * 0.1:
        return (rng.standard_normal(n) * 3e-5).astype(np.float32)
    start = int(rng.integers(0, len(tone)))
    reps = int(np.ceil((start + n) / len(tone))) + 1
    return np.tile(tone, reps)[start : start + n].astype(np.float32)


def assemble(
    chunks: list[tuple[np.ndarray, int, bool]],
    texture: VoiceTexture,
    seed: int | None = None,
) -> np.ndarray:
    """Join (audio, pause_ms, breath_before_next) chunks like a human edit:
    pauses with natural variation, filled with real room tone, and a real
    breath before new thoughts."""
    rng = np.random.default_rng(seed)
    out: list[np.ndarray] = []
    for i, (audio, pause_ms, breathe) in enumerate(chunks):
        out.append(_fade(audio, 8))
        if i == len(chunks) - 1:
            break
        # People never pause the same way twice: ±18 % jitter.
        # Never longer than a natural paragraph pause (breath included) —
        # longer gaps sound like the voice has stopped.
        gap = min(int(SR * pause_ms / 1000 * rng.uniform(0.82, 1.18)), int(SR * 0.62))
        bed = _bed(texture, gap, rng)
        if breathe and texture.breaths and gap > SR * 0.3:
            breath = texture.breaths[int(rng.integers(0, len(texture.breaths)))]
            breath = breath * rng.uniform(0.55, 0.8)  # breaths sit under the voice
            # Place the inhale so it ends ~60-120 ms before the next word.
            end = gap - int(SR * rng.uniform(0.06, 0.12))
            start = max(int(SR * 0.08), end - len(breath))
            seg = breath[-(end - start) :] if end - start < len(breath) else breath
            bed[start : start + len(seg)] += seg
        out.append(bed)
    return np.concatenate(out) if out else np.zeros(1, np.float32)
