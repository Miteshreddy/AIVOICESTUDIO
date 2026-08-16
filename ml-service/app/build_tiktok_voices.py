"""
Builds "TIK 1" and "TIK 2" — ultra-fast-paced, high-dopamine TikTok-style
voices with crisp, loud articulation. Same bootstrap pipeline as the
YouTube Shorts / IMP voices, but pushed further on pace and clarity:
higher cfg_weight for articulation precision, punchy short-clause scripts
written in actual TikTok voiceover hook style (curiosity gap, urgency,
pattern interrupts), maxed loudness + bright presence EQ.

Requires the ml-service server already running:
    python -m app.build_tiktok_voices
"""

import io
import sys

import librosa
import numpy as np
import soundfile as sf

from . import voice_store
from .audio_processing import apply_eq, apply_normalize
from .build_creator_voices import find_voice_id, synthesize_via_server

SILENCE_GAP_S = 0.3  # tighter gap — these voices are built to feel rapid-fire

DEFINITIONS = [
    {
        "name": "TIK 1",
        "description": "Fast-paced, high-dopamine male voice — rapid-fire hooks, crisp articulation, built for TikTok/Shorts pacing.",
        "tags": ["creator", "tiktok", "fast", "dopamine", "loud", "male"],
        "base_voice": "Gabriel",
        "exaggeration": 0.9,
        "cfg_weight": 0.65,
        "temperature": 0.7,
        "scripts": [
            "Okay — three, two, one — watch this. You are NOT ready for what happens right here.",
            "Stop. Right there. This is the part you came for, so watch closely, because it's about to happen.",
        ],
    },
    {
        "name": "TIK 2",
        "description": "Fast-paced, high-dopamine female voice — rapid-fire hooks, crisp articulation, built for TikTok/Shorts pacing.",
        "tags": ["creator", "tiktok", "fast", "dopamine", "loud", "female"],
        "base_voice": "Emma",
        "exaggeration": 0.9,
        "cfg_weight": 0.65,
        "temperature": 0.7,
        "scripts": [
            "Okay wait, wait, wait — before you scroll, you need to see this, I promise, trust me.",
            "This is your sign. Right now. Don't scroll past it, because this one's actually worth it.",
        ],
    },
]


def estimate_pitch(y: np.ndarray, sr: int) -> float:
    f0 = librosa.yin(y, fmin=60, fmax=400, sr=sr)
    f0 = f0[np.isfinite(f0)]
    return float(np.median(f0)) if len(f0) else 150.0


def build_voice(defn: dict) -> None:
    for voice in voice_store.list_voices():
        if voice["name"] == defn["name"]:
            voice_store.delete_voice(voice["id"])
            print(f"Removed existing '{defn['name']}'.")

    base_voice_id = find_voice_id(defn["base_voice"])
    print(f"Bootstrapping '{defn['name']}' from base voice '{defn['base_voice']}'…")

    clips = []
    for script in defn["scripts"]:
        audio_bytes = synthesize_via_server(
            script,
            base_voice_id,
            exaggeration=defn["exaggeration"],
            cfg_weight=defn["cfg_weight"],
            temperature=defn["temperature"],
        )
        y, sr = sf.read(io.BytesIO(audio_bytes), dtype="float32", always_2d=False)
        if y.ndim > 1:
            y = y.mean(axis=1)
        trimmed, _ = librosa.effects.trim(y, top_db=35)
        clips.append((trimmed, sr))

    sr = clips[0][1]
    gap = np.zeros(int(SILENCE_GAP_S * sr), dtype=np.float32)
    pieces = []
    for y, clip_sr in clips:
        assert clip_sr == sr
        pieces.append(y)
        pieces.append(gap)
    combined = np.concatenate(pieces[:-1])

    # Max clarity + max loudness — this is the whole brief.
    combined = apply_eq(combined, sr, "bright")
    combined = apply_normalize(combined, sr, amount=100)

    pitch = estimate_pitch(combined, sr)
    print(f"  -> {len(combined) / sr:.1f}s reference, measured f0={pitch:.0f}Hz")

    buffer = io.BytesIO()
    sf.write(buffer, combined, sr, format="WAV")

    voice_store.create_voice(
        defn["name"],
        defn["description"],
        buffer.getvalue(),
        tags=defn["tags"],
        source="library",
        gender="male" if pitch < 165 else "female",
    )


def main() -> None:
    print("Building 2 TikTok-optimized creator voices…\n")
    for defn in DEFINITIONS:
        build_voice(defn)
    print("\nDone — TIK 1 and TIK 2 registered.")


if __name__ == "__main__":
    sys.exit(main())
