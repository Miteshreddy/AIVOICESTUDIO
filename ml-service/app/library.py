"""Candidate voices for the built-in library: real people, real recordings.

Source: LibriTTS-R (CC-BY-4.0) — audiobook narration restored to studio
quality. Chatterbox-Turbo copies timbre *and delivery* from the first ~15 s of
a reference, so each candidate reference is built from long, continuous
utterances from one chapter (natural flow, no artificial silence), and only
speakers with lively pitch movement are kept.

Candidates are cached under CANDIDATES_DIR so auditions can be re-run
without re-downloading. Run via:  python -m app.curate_voices
"""

import io
import json
from collections import defaultdict
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

SR = 24000
CANDIDATES_DIR = Path(r"G:\KAIZ_AI\candidates") if Path("G:/").exists() else Path(__file__).parent.parent / "candidates"
MIN_UTTERANCE_S = 6.0
MAX_UTTERANCE_S = 16.0
TARGET_S = 18.0


def pitch_profile(audio: np.ndarray, sr: int = SR) -> tuple[float, float]:
    """(median F0 in Hz, pitch movement in semitones std)."""
    f0, voiced, _ = librosa.pyin(audio, fmin=60, fmax=420, sr=sr, frame_length=1024)
    f0 = f0[voiced & ~np.isnan(f0)]
    if len(f0) < 10:
        return 150.0, 0.0
    return float(np.median(f0)), float(np.std(12 * np.log2(f0 / np.median(f0))))


def _join(utterances: list[np.ndarray]) -> np.ndarray:
    """Join utterances with a short crossfade over their own natural edges."""
    out = utterances[0]
    for u in utterances[1:]:
        n = int(SR * 0.04)
        ramp = np.linspace(0, 1, n, dtype=np.float32)
        out = np.concatenate([out[:-n], out[-n:] * (1 - ramp) + u[:n] * ramp, u[n:]])
    return out


def gather(per_gender: int, max_rows: int = 150_000) -> list[dict]:
    """Stream LibriTTS-R and cache `per_gender` lively candidates per gender."""
    from datasets import Audio, load_dataset

    CANDIDATES_DIR.mkdir(parents=True, exist_ok=True)
    existing = [json.loads(p.read_text()) for p in CANDIDATES_DIR.glob("*.json")]
    counts = {"female": 0, "male": 0}
    for c in existing:
        counts[c["gender"]] += 1
    done = {c["speaker"] for c in existing}
    if min(counts.values()) >= per_gender:
        return existing

    ds = load_dataset("mythicinfinity/libritts_r", "clean", split="train.clean.360", streaming=True)
    ds = ds.cast_column("audio", Audio(decode=False))

    buckets: dict[tuple, list[np.ndarray]] = defaultdict(list)
    seconds: dict[tuple, float] = defaultdict(float)
    for i, row in enumerate(ds):
        if i > max_rows or min(counts.values()) >= per_gender:
            break
        spk = str(row["speaker_id"])
        if spk in done:
            continue
        audio, sr = sf.read(io.BytesIO(row["audio"]["bytes"]), dtype="float32", always_2d=False)
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        dur = len(audio) / sr
        if not MIN_UTTERANCE_S <= dur <= MAX_UTTERANCE_S:
            continue
        if sr != SR:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=SR)
        key = (spk, row["chapter_id"])
        buckets[key].append(audio)
        seconds[key] += dur
        if seconds[key] < TARGET_S:
            continue

        clip = _join(buckets.pop(key))
        done.add(spk)
        median, movement = pitch_profile(clip[: SR * 15])
        gender = "female" if median > 165 else "male"
        if counts[gender] >= per_gender or movement < 2.2:  # skip monotone readers
            continue
        counts[gender] += 1
        clip = clip / max(1e-6, float(np.max(np.abs(clip)))) * 0.9
        sf.write(CANDIDATES_DIR / f"{spk}.wav", clip, SR)
        meta = {"speaker": spk, "gender": gender, "pitch": median, "movement": movement}
        (CANDIDATES_DIR / f"{spk}.json").write_text(json.dumps(meta))
        existing.append(meta)
        print(f"  candidate {spk:>5} {gender:6s} pitch {median:5.0f} Hz  movement {movement:.1f} st  "
              f"[{counts['female']}F/{counts['male']}M]", flush=True)
    return existing
