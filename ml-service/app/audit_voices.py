"""
Audits every registered voice's reference audio for objective quality
problems: corrupted files, clipping, excessive silence, too-short
references, abnormal loudness, or a broken/defaulted pitch read.

This only reads the stored reference files directly (no GPU/model needed),
so it runs fast across the whole library.

Run:
    python -m app.audit_voices
"""

import sys

import librosa
import numpy as np
import soundfile as sf

from . import voice_store

MIN_DURATION_S = 6.0
MAX_CLIPPING_RATIO = 0.001
MAX_SILENCE_RATIO = 0.5
MIN_RMS = 0.01
MAX_PEAK = 1.0


def analyze_reference(path) -> dict:
    y, sr = sf.read(path, dtype="float32", always_2d=False)
    if y.ndim > 1:
        y = y.mean(axis=1)

    duration = len(y) / sr if sr else 0
    peak = float(np.max(np.abs(y))) if len(y) else 0.0
    rms = float(np.sqrt(np.mean(y**2))) if len(y) else 0.0
    clipping_ratio = float(np.mean(np.abs(y) >= 0.999)) if len(y) else 0.0
    silence_ratio = float(np.mean(np.abs(y) < 0.01)) if len(y) else 1.0

    f0 = librosa.yin(y, fmin=60, fmax=400, sr=sr) if len(y) > sr * 0.1 else np.array([])
    f0 = f0[np.isfinite(f0)]
    pitch = float(np.median(f0)) if len(f0) else 0.0

    return {
        "duration": duration,
        "peak": peak,
        "rms": rms,
        "clipping_ratio": clipping_ratio,
        "silence_ratio": silence_ratio,
        "pitch": pitch,
    }


def main() -> None:
    voices = voice_store.list_voices()
    print(f"Auditing {len(voices)} voices…\n")

    problems: list[tuple[str, str, dict]] = []
    all_stats = []

    for voice in voices:
        path = voice_store.get_reference_path(voice["id"])
        name = voice["name"]
        if not path:
            problems.append((name, "missing reference file", {}))
            continue
        try:
            stats = analyze_reference(path)
        except Exception as exc:  # noqa: BLE001
            problems.append((name, f"unreadable/corrupted: {exc}", {}))
            continue

        all_stats.append((name, stats))

        if stats["duration"] < MIN_DURATION_S:
            problems.append((name, f"too short ({stats['duration']:.1f}s)", stats))
        if stats["clipping_ratio"] > MAX_CLIPPING_RATIO:
            problems.append((name, f"clipping ({stats['clipping_ratio'] * 100:.2f}% of samples)", stats))
        if stats["silence_ratio"] > MAX_SILENCE_RATIO:
            problems.append((name, f"mostly silence ({stats['silence_ratio'] * 100:.0f}%)", stats))
        if stats["rms"] < MIN_RMS:
            problems.append((name, f"too quiet (RMS={stats['rms']:.4f})", stats))
        if stats["pitch"] <= 0:
            problems.append((name, "pitch read failed (0Hz — likely near-silent or corrupt)", stats))
        if stats["peak"] > MAX_PEAK:
            problems.append((name, f"peak over full scale ({stats['peak']:.3f})", stats))

    print(f"Checked {len(all_stats)} readable references.\n")

    if problems:
        print(f"PROBLEMS FOUND ({len(problems)}):\n")
        for name, issue, stats in problems:
            print(f"  [{name}] {issue}")
    else:
        print("No structural problems found in any reference audio.")

    durations = [s["duration"] for _, s in all_stats]
    peaks = [s["peak"] for _, s in all_stats]
    rms_vals = [s["rms"] for _, s in all_stats]
    print(f"\nDuration range: {min(durations):.1f}s - {max(durations):.1f}s (median {np.median(durations):.1f}s)")
    print(f"Peak range: {min(peaks):.3f} - {max(peaks):.3f}")
    print(f"RMS range: {min(rms_vals):.4f} - {max(rms_vals):.4f}")


if __name__ == "__main__":
    sys.exit(main())
