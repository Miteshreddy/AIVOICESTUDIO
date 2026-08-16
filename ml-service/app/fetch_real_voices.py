"""
Builds the library out of REAL human recordings from the VCTK corpus
(CC-BY-4.0, ~108 English speakers, University of Edinburgh:
https://datashare.ed.ac.uk/handle/10283/3443).

Every voice is a real person's clean recording — no pitch-shifting, no EQ
mangling, no fictional "character" mapping. Multiple utterances per speaker
are concatenated (not just one short clip) to give the zero-shot cloner more
material to work with, which measurably improves clone fidelity. Names are
generic human first names (the same convention ElevenLabs' own default
library uses) — gender and tone/pace tags are derived from measurements of
the actual audio (pitch, pitch variance, speaking rate), not invented.

Run with the ml-service NOT necessarily running (this doesn't need the TTS
model, only downloads real audio and registers it):
    python -m app.fetch_real_voices
"""

import io
import sys

import librosa
import numpy as np
import soundfile as sf
from datasets import Audio, load_dataset

from . import voice_store

MIN_TEXT_LEN = 20
MIN_CLIP_DURATION_S = 1.2
MAX_CLIP_DURATION_S = 12.0
UTTERANCES_PER_SPEAKER = 6
TARGET_SPEAKER_DURATION_S = 22.0
MIN_SPEAKER_DURATION_S = 8.0
MAX_ROWS_SCANNED = 90_000
SILENCE_GAP_S = 0.35

MALE_NAMES = [
    "James", "Oliver", "Daniel", "Henry", "Thomas", "William", "Jack", "Samuel",
    "Benjamin", "Charlie", "Edward", "George", "Harry", "Joseph", "Leo", "Lewis",
    "Max", "Noah", "Oscar", "Owen", "Reuben", "Ryan", "Sebastian", "Theo",
    "Adam", "Alexander", "Andrew", "Arthur", "Callum", "Connor", "David", "Dylan",
    "Ethan", "Felix", "Finn", "Frederick", "Gabriel", "Isaac", "Jacob", "Jake",
    "Jasper", "Josh", "Kai", "Liam", "Louis", "Luke", "Marcus", "Mason",
    "Matthew", "Michael", "Nathan", "Nicholas", "Patrick", "Peter", "Robert",
    "Rory", "Simon", "Stephen", "Toby", "Victor", "Zach",
]

FEMALE_NAMES = [
    "Amelia", "Emily", "Sophia", "Isla", "Olivia", "Ava", "Grace", "Freya",
    "Charlotte", "Ella", "Evie", "Florence", "Hannah", "Holly", "Ivy", "Jessica",
    "Lily", "Lucy", "Maya", "Millie", "Molly", "Nora", "Phoebe", "Poppy",
    "Rosie", "Ruby", "Alice", "Beatrice", "Bella", "Chloe", "Clara", "Daisy",
    "Eleanor", "Elsie", "Emma", "Erin", "Esme", "Faith", "Fiona", "Georgia",
    "Hazel", "Imogen", "Iris", "Jasmine", "Katie", "Kayla", "Layla", "Leah",
    "Maisie", "Maria", "Megan", "Mia", "Naomi", "Natasha", "Nina", "Paige",
    "Sadie", "Sarah", "Sienna", "Willow", "Zara",
]


def estimate_pitch_hz(y: np.ndarray, sr: int) -> tuple[float, float]:
    """Returns (median_f0, coefficient_of_variation) for expressiveness scoring."""
    f0 = librosa.yin(y, fmin=60, fmax=400, sr=sr)
    f0 = f0[np.isfinite(f0)]
    if not len(f0):
        return 150.0, 0.0
    median = float(np.median(f0))
    cv = float(np.std(f0) / median) if median else 0.0
    return median, cv


def clear_existing_library_voices() -> int:
    removed = 0
    for voice in voice_store.list_voices():
        if voice.get("source") == "library":
            voice_store.delete_voice(voice["id"])
            removed += 1
    return removed


def collect_real_speakers() -> dict[str, list[tuple[np.ndarray, int, str]]]:
    print("Streaming VCTK (jspaulsen/vctk, CC-BY-4.0)…")
    ds = load_dataset("jspaulsen/vctk", split="train", streaming=True)
    # Decode audio ourselves via soundfile instead of the datasets library's
    # default (which now requires the extra torchcodec dependency).
    ds = ds.cast_column("audio", Audio(decode=False))

    speakers: dict[str, list[tuple[np.ndarray, int, str]]] = {}
    scanned = 0

    for row in ds:
        scanned += 1
        if scanned > MAX_ROWS_SCANNED:
            break
        if row.get("mic_id") != "mic1":
            continue
        text = row.get("text") or ""
        if len(text) < MIN_TEXT_LEN:
            continue

        speaker_id = row["speaker_id"]
        clips = speakers.setdefault(speaker_id, [])
        have_duration = sum(len(y) / sr for y, sr, _ in clips)
        if len(clips) >= UTTERANCES_PER_SPEAKER or have_duration >= TARGET_SPEAKER_DURATION_S:
            continue  # already have enough for this speaker — skip the decode cost

        raw_bytes = row["audio"]["bytes"]
        y, sr = sf.read(io.BytesIO(raw_bytes), dtype="float32", always_2d=False)
        if y.ndim > 1:
            y = y.mean(axis=1)
        duration = len(y) / sr
        if duration < MIN_CLIP_DURATION_S or duration > MAX_CLIP_DURATION_S:
            continue

        clips.append((y, sr, text))
        if len(clips) == 1:
            print(f"  new speaker {speaker_id} ({len(speakers)} distinct so far, row {scanned})")

    usable = {sid: c for sid, c in speakers.items() if sum(len(y) / sr for y, sr, _ in c) >= MIN_SPEAKER_DURATION_S}
    print(f"\nScanned {scanned} rows — {len(speakers)} distinct speakers seen, {len(usable)} have enough clean audio.")
    return usable


def build_reference(clips: list[tuple[np.ndarray, int, str]]) -> tuple[np.ndarray, int, str]:
    sr = clips[0][1]
    gap = np.zeros(int(SILENCE_GAP_S * sr), dtype=np.float32)
    pieces = []
    texts = []
    for y, clip_sr, text in clips:
        assert clip_sr == sr
        trimmed, _ = librosa.effects.trim(y, top_db=35)
        if len(trimmed) == 0:
            continue
        pieces.append(trimmed)
        pieces.append(gap)
        texts.append(text)
    combined = np.concatenate(pieces[:-1]) if pieces else np.array([], dtype=np.float32)
    peak = float(np.max(np.abs(combined))) if len(combined) else 0.0
    if peak > 0:
        combined = combined / peak * 0.95
    return combined, sr, " ".join(texts)


def pick_tone_tag(pitch_hz: float, gender: str, bands: dict[str, tuple[float, float]]) -> str:
    lo, hi = bands[gender]
    if pitch_hz < lo:
        return "deep" if gender == "male" else "warm"
    if pitch_hz > hi:
        return "bright" if gender == "male" else "light"
    return "warm" if gender == "male" else "bright"


def main() -> None:
    removed = clear_existing_library_voices()
    if removed:
        print(f"Removed {removed} old library voices.\n")

    speakers = collect_real_speakers()
    if not speakers:
        print("No speakers collected — aborting.")
        return

    print("\nBuilding reference clips and measuring voices…\n")
    profiles = []
    for speaker_id, clips in speakers.items():
        combined, sr, text = build_reference(clips)
        if len(combined) / sr < MIN_SPEAKER_DURATION_S * 0.6:
            continue
        pitch, cv = estimate_pitch_hz(combined, sr)
        gender = "male" if pitch < 165 else "female"
        pace_chars_per_s = len(text) / (len(combined) / sr) if len(combined) else 0.0
        profiles.append(
            {
                "speaker_id": speaker_id,
                "audio": combined,
                "sr": sr,
                "pitch": pitch,
                "cv": cv,
                "pace": pace_chars_per_s,
                "gender": gender,
                "duration": len(combined) / sr,
            }
        )

    male = sorted([p for p in profiles if p["gender"] == "male"], key=lambda p: p["pitch"])
    female = sorted([p for p in profiles if p["gender"] == "female"], key=lambda p: p["pitch"])
    print(f"Collected {len(male)} male-register and {len(female)} female-register voices.\n")

    def tertile_bands(values: list[float]) -> tuple[float, float]:
        if not values:
            return (0.0, 0.0)
        arr = np.array(sorted(values))
        return float(arr[len(arr) // 3]), float(arr[2 * len(arr) // 3])

    bands = {
        "male": tertile_bands([p["pitch"] for p in male]),
        "female": tertile_bands([p["pitch"] for p in female]),
    }
    all_paces = [p["pace"] for p in profiles]
    pace_bands = tertile_bands(all_paces)
    all_cvs = [p["cv"] for p in profiles]
    cv_median = float(np.median(all_cvs)) if all_cvs else 0.0

    male_names = list(MALE_NAMES)
    female_names = list(FEMALE_NAMES)

    registered = 0
    for pool_name, pool, names in (("male", male, male_names), ("female", female, female_names)):
        for i, profile in enumerate(pool):
            if i >= len(names):
                break
            name = names[i]
            tone = pick_tone_tag(profile["pitch"], pool_name, bands)
            pace_lo, pace_hi = pace_bands
            pace_tag = "brisk" if profile["pace"] > pace_hi else "relaxed" if profile["pace"] < pace_lo else "measured"
            delivery_tag = "expressive" if profile["cv"] > cv_median else "steady"

            tags = [pool_name, tone, pace_tag, delivery_tag]
            article = "an" if delivery_tag[0] in "aeiou" else "a"
            description = (
                f"{tone.capitalize()}, {pace_tag} {pool_name} voice with {article} {delivery_tag} delivery."
            )

            buffer = io.BytesIO()
            sf.write(buffer, profile["audio"], profile["sr"], format="WAV")

            voice_store.create_voice(
                name,
                description,
                buffer.getvalue(),
                tags=tags,
                source="library",
                gender=pool_name,
            )
            registered += 1
            print(
                f"  [{registered}] {name:<12} <- speaker {profile['speaker_id']} "
                f"({pool_name}, f0={profile['pitch']:.0f}Hz, {tone}/{pace_tag}/{delivery_tag}, "
                f"{profile['duration']:.1f}s)"
            )

    print(f"\nDone — {registered} real-voice library entries registered.")


if __name__ == "__main__":
    sys.exit(main())
