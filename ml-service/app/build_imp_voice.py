"""
Builds "IMP 1" — an original deep, resonant, comforting middle-aged male
voice for social/narration use. This is NOT a clone of any specific real
person or commercial product (e.g. ElevenLabs' "Brian") — it's bootstrapped
from our own licensed library voice using the same pipeline as the
YouTube Shorts creator voices, just tuned for warmth and resonance instead
of hype.

Requires the ml-service server already running:
    python -m app.build_imp_voice
"""

import io
import sys

import librosa
import numpy as np
import soundfile as sf

from . import voice_store
from .audio_processing import apply_eq, apply_normalize
from .build_creator_voices import find_voice_id, synthesize_via_server

SILENCE_GAP_S = 0.35

DEFINITION = {
    "name": "IMP 1",
    "description": "Deep, resonant, comforting middle-aged male voice — narration, social media, storytelling.",
    "tags": ["creator", "resonant", "comforting", "deep", "male"],
    "base_voice": "Thomas",
    "exaggeration": 0.6,
    "cfg_weight": 0.6,
    "temperature": 0.65,
    "scripts": [
        "There's something powerful about a story told well — the kind that stays with you long after the moment has passed.",
        "Take a breath. Whatever's on your mind right now, we're going to walk through it together, one step at a time.",
    ],
}


def estimate_pitch(y: np.ndarray, sr: int) -> float:
    f0 = librosa.yin(y, fmin=60, fmax=400, sr=sr)
    f0 = f0[np.isfinite(f0)]
    return float(np.median(f0)) if len(f0) else 150.0


def main() -> None:
    for voice in voice_store.list_voices():
        if voice["name"] == DEFINITION["name"]:
            voice_store.delete_voice(voice["id"])
            print(f"Removed existing '{DEFINITION['name']}'.\n")

    base_voice_id = find_voice_id(DEFINITION["base_voice"])
    print(f"Bootstrapping '{DEFINITION['name']}' from base voice '{DEFINITION['base_voice']}'…")

    clips = []
    for script in DEFINITION["scripts"]:
        audio_bytes = synthesize_via_server(
            script,
            base_voice_id,
            exaggeration=DEFINITION["exaggeration"],
            cfg_weight=DEFINITION["cfg_weight"],
            temperature=DEFINITION["temperature"],
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

    # Warm presence EQ (not "bright" — this voice is comforting, not hyped) + solid,
    # clear loudness for social media without maxing it out like the shorts voices.
    combined = apply_eq(combined, sr, "warm")
    combined = apply_normalize(combined, sr, amount=85)

    pitch = estimate_pitch(combined, sr)
    print(f"  -> {len(combined) / sr:.1f}s reference, measured f0={pitch:.0f}Hz")

    buffer = io.BytesIO()
    sf.write(buffer, combined, sr, format="WAV")

    voice_store.create_voice(
        DEFINITION["name"],
        DEFINITION["description"],
        buffer.getvalue(),
        tags=DEFINITION["tags"],
        source="library",
        gender="male" if pitch < 165 else "female",
    )
    print("\nDone — 'IMP 1' registered.")


if __name__ == "__main__":
    sys.exit(main())
