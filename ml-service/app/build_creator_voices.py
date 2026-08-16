"""
Builds 5 voices purpose-designed for YouTube Shorts / short-form content —
loud, clear, high-energy delivery — as opposed to the neutral narration-style
voices in the main VCTK-derived library.

These are NOT clones of any real person found on the web. Cloning an
identifiable creator's actual voice without consent is a real legal/ethical
problem (voice-likeness rights), not just a technical one. Instead, each
voice is bootstrapped from our own licensed pipeline: take an existing
library voice as a base identity, push Chatterbox's expressiveness controls
to their limit with a script written in that exact delivery style, then
master the result loud and bright — and register THAT as the new voice's
reference clip, so every future generation from it inherits the energetic
character instead of the calm original.

Requires the ml-service server already running (calls its /tts endpoint
directly, rather than loading a second model instance into GPU memory
alongside the running server):
    python -m app.build_creator_voices
"""

import io
import sys

import librosa
import numpy as np
import requests
import soundfile as sf

from . import voice_store
from .audio_processing import apply_eq, apply_normalize
from .config import HOST, PORT

SILENCE_GAP_S = 0.35
BASE_URL = f"http://{'localhost' if HOST == '0.0.0.0' else HOST}:{PORT}"


def synthesize_via_server(text: str, voice_id: str, exaggeration: float, cfg_weight: float, temperature: float) -> bytes:
    resp = requests.post(
        f"{BASE_URL}/tts",
        json={
            "text": text,
            "voiceId": voice_id,
            "exaggeration": exaggeration,
            "cfgWeight": cfg_weight,
            "temperature": temperature,
        },
        timeout=120,
    )
    resp.raise_for_status()
    return resp.content

# (base_voice_name, exaggeration, cfg_weight, temperature, [scripts])
DEFINITIONS = [
    {
        "name": "YouTube Shorts Voice 1",
        "description": "Explosive reaction/hype energy — gaming clips, challenges, \"wait for it\" moments.",
        "tags": ["creator", "shorts", "hype", "loud", "male"],
        "base_voice": "Ethan",
        "exaggeration": 0.9,
        "cfg_weight": 0.5,
        "temperature": 0.75,
        "scripts": [
            "Wait, wait, wait — you are NOT ready for this. Watch till the end, because what happens next is absolutely insane!",
            "No way. No WAY. Okay I need everyone to see this right now, this is actually unbelievable.",
        ],
    },
    {
        "name": "YouTube Shorts Voice 2",
        "description": "Deep, booming trailer-announcer energy — epic reveals, \"in a world where\" hooks.",
        "tags": ["creator", "shorts", "announcer", "deep", "male"],
        "base_voice": "James",
        "exaggeration": 0.85,
        "cfg_weight": 0.55,
        "temperature": 0.7,
        "scripts": [
            "In a world where every second counts... one moment... changes everything.",
            "This is the story they didn't want you to hear. And it starts right now.",
        ],
    },
    {
        "name": "YouTube Shorts Voice 3",
        "description": "Fast, crisp infotainment pace — quick facts, explainer hooks, listicle voiceovers.",
        "tags": ["creator", "shorts", "explainer", "fast", "male"],
        "base_voice": "Josh",
        "exaggeration": 0.7,
        "cfg_weight": 0.6,
        "temperature": 0.65,
        "scripts": [
            "Okay here's a fact that's gonna blow your mind, and I promise, it takes literally ten seconds to explain.",
            "Number one on this list is something you have used every single day, and never once noticed.",
        ],
    },
    {
        "name": "YouTube Shorts Voice 4",
        "description": "Bright, confident female hype energy — lifestyle, motivation, GRWM-style hooks.",
        "tags": ["creator", "shorts", "hype", "loud", "female"],
        "base_voice": "Olivia",
        "exaggeration": 0.85,
        "cfg_weight": 0.55,
        "temperature": 0.75,
        "scripts": [
            "Okay besties, drop what you're doing right now, because I am about to change your entire life in the next thirty seconds.",
            "Stop scrolling. Seriously, stop — you need to hear this before you do literally anything else today.",
        ],
    },
    {
        "name": "YouTube Shorts Voice 5",
        "description": "Playful, exaggerated comedic-narrator timing — meme compilations, fail videos.",
        "tags": ["creator", "shorts", "comedy", "playful", "male"],
        "base_voice": "Isaac",
        "exaggeration": 0.9,
        "cfg_weight": 0.5,
        "temperature": 0.8,
        "scripts": [
            "So this genius, and I use that term VERY loosely, decided this was a good idea. Let's watch it go horribly, hilariously wrong.",
            "Okay so nobody asked him to do this. Nobody. And yet, here we are.",
        ],
    },
]


def find_voice_id(name: str) -> str:
    for voice in voice_store.list_voices():
        if voice["name"] == name:
            return voice["id"]
    raise RuntimeError(f"Base voice '{name}' not found in library — run fetch_real_voices first.")


def clear_existing_creator_voices() -> int:
    removed = 0
    for voice in voice_store.list_voices():
        if "creator" in voice.get("tags", []):
            voice_store.delete_voice(voice["id"])
            removed += 1
    return removed


def master_loud_and_clear(y: np.ndarray, sr: int) -> np.ndarray:
    """Shorts-appropriate mastering: bright presence EQ + loud normalize (~-14 LUFS)."""
    y = apply_eq(y, sr, "bright")
    y = apply_normalize(y, sr, amount=97)
    return y


def build_voice(defn: dict) -> None:
    base_voice_id = find_voice_id(defn["base_voice"])
    print(f"  Bootstrapping '{defn['name']}' from base voice '{defn['base_voice']}'…")

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

    combined = master_loud_and_clear(combined, sr)

    pitch = estimate_pitch(combined, sr)
    print(f"    -> {len(combined) / sr:.1f}s reference, measured f0={pitch:.0f}Hz")

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


def estimate_pitch(y: np.ndarray, sr: int) -> float:
    f0 = librosa.yin(y, fmin=60, fmax=400, sr=sr)
    f0 = f0[np.isfinite(f0)]
    return float(np.median(f0)) if len(f0) else 150.0


def main() -> None:
    removed = clear_existing_creator_voices()
    if removed:
        print(f"Removed {removed} existing creator voices.\n")

    print("Building 5 shorts-optimized creator voices…\n")
    for defn in DEFINITIONS:
        build_voice(defn)

    print("\nDone — 5 creator voices registered.")


if __name__ == "__main__":
    sys.exit(main())
