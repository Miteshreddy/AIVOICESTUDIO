"""
Rebuilds a single voice's reference audio from its original VCTK speaker.
Some speakers record with long internal pauses that a plain leading/trailing
trim doesn't remove — this strips internal silence via split-and-rejoin
instead of just rejecting whole clips (some speakers pause on nearly every
utterance, so rejection alone converges too slowly or not at all).

Run:
    python -m app.fix_voice_reference <voice_name> <vctk_speaker_id>
"""

import io
import sys

import librosa
import numpy as np
import soundfile as sf
from datasets import Audio, load_dataset

from . import voice_store

SILENCE_GAP_S = 0.25
MAX_ROWS_SCANNED = 90_000
TARGET_DURATION_S = 20.0


def strip_internal_silence(y: np.ndarray, sr: int) -> np.ndarray:
    """Some speakers' recordings have long internal pauses that a plain
    leading/trailing trim doesn't touch. Split on silence and rejoin only the
    voiced segments with short natural gaps — removes dead air without
    rejecting otherwise-usable clips."""
    intervals = librosa.effects.split(y, top_db=35)
    if len(intervals) <= 1:
        return y
    gap = np.zeros(int(0.12 * sr), dtype=np.float32)
    pieces = []
    for start, end in intervals:
        pieces.append(y[start:end])
        pieces.append(gap)
    return np.concatenate(pieces[:-1])


def collect_clean_clips(target_speaker: str) -> list[tuple[np.ndarray, int]]:
    print(f"Streaming VCTK looking for speaker {target_speaker}…")
    ds = load_dataset("jspaulsen/vctk", split="train", streaming=True)
    ds = ds.cast_column("audio", Audio(decode=False))

    clips: list[tuple[np.ndarray, int]] = []
    total_duration = 0.0
    scanned = 0

    for row in ds:
        scanned += 1
        if scanned > MAX_ROWS_SCANNED or total_duration >= TARGET_DURATION_S:
            break
        if row.get("mic_id") != "mic1" or row["speaker_id"] != target_speaker:
            continue
        text = row.get("text") or ""
        if len(text) < 20:
            continue

        raw_bytes = row["audio"]["bytes"]
        y, sr = sf.read(io.BytesIO(raw_bytes), dtype="float32", always_2d=False)
        if y.ndim > 1:
            y = y.mean(axis=1)
        duration = len(y) / sr
        if duration < 1.2 or duration > 12.0:
            continue

        cleaned = strip_internal_silence(y, sr)
        if len(cleaned) < sr * 0.3:
            continue

        clips.append((cleaned, sr))
        total_duration += len(cleaned) / sr
        print(f"  accepted clip ({total_duration:.1f}s total so far)")

    print(f"Scanned {scanned} rows, collected {len(clips)} clean clips.")
    return clips


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: python -m app.fix_voice_reference <voice_name> <vctk_speaker_id>")
        sys.exit(1)
    voice_name, speaker_id = sys.argv[1], sys.argv[2]

    target = next((v for v in voice_store.list_voices() if v["name"] == voice_name), None)
    if not target:
        print(f"Voice '{voice_name}' not found.")
        sys.exit(1)

    clips = collect_clean_clips(speaker_id)
    if not clips:
        print("No clean clips found — aborting, existing reference left untouched.")
        sys.exit(1)

    sr = clips[0][1]
    gap = np.zeros(int(SILENCE_GAP_S * sr), dtype=np.float32)
    pieces = []
    for y, clip_sr in clips:
        assert clip_sr == sr
        pieces.append(y)
        pieces.append(gap)
    combined = np.concatenate(pieces[:-1])

    peak = float(np.max(np.abs(combined))) if len(combined) else 0.0
    if peak > 0:
        combined = combined / peak * 0.95

    buffer = io.BytesIO()
    sf.write(buffer, combined, sr, format="WAV")

    reference_path = voice_store.get_reference_path(target["id"])
    reference_path.write_bytes(buffer.getvalue())

    silence_ratio = float(np.mean(np.abs(combined) < 0.01))
    print(
        f"\nRebuilt '{voice_name}' reference: {len(combined) / sr:.1f}s, "
        f"overall silence ratio {silence_ratio * 100:.0f}%."
    )


if __name__ == "__main__":
    sys.exit(main())
