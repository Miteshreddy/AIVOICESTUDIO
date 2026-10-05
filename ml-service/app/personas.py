"""Persona voices: a specific real speaker *performing* a specific style.

Why this exists: a zero-shot model copies whatever it hears in the reference
— timbre, mic character AND delivery. ElevenLabs library voices sound
distinct ("Energetic YouTube Narrator", "Calm & Professional") because each is
cloned from a voice actor performing in that style. Our earlier voices were
all audiobook narrators, so they all shared one calm, read-aloud mood.

Source: EARS (facebookresearch/ears_dataset, CC-BY-NC 4.0 — personal use):
studio-anechoic 48 kHz recordings, with spontaneous ("freeform") speech in
22 emotions per speaker. For every persona we audition each candidate speaker
performing that persona's style, then pick the best with no speaker reused.

    python -m app.personas            (engine must be running on :8095)
"""

import io
import json
import time
from dataclasses import dataclass
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
import torch

from . import generation_store, voice_store
from .curate_voices import _post_json, _transcribe, _wer
from .library import pitch_profile
from .mastering import _centroid

EARS_DIR = Path(r"G:\KAIZ_AI\ears")
OUT_DIR = Path(r"G:\KAIZ_AI\personas")
SR = 24000
REF_SECONDS = 16.0


@dataclass
class Persona:
    voice_id: str
    name: str
    gender: str
    title: str  # shown in the UI, ElevenLabs-style
    sources: tuple[str, ...]  # EARS files to draw the performance from, in priority order
    lines: tuple[str, ...]  # audition script in this persona's register


PERSONAS = [
    Persona(
        "voice-ethan", "Ethan", "male", "Energetic YouTube Narrator",
        ("emo_interest_freeform", "emo_amazement_freeform", "emo_extasy_freeform"),
        ("So that's how one tiny change gets us closer to a real Jarvis. And honestly? It's only getting started.",
         "If this changed how you think about AI, hit subscribe, because next week we're going even deeper."),
    ),
    Persona(
        "voice-aria", "Aria", "female", "Upbeat, Bright and Clear",
        ("emo_amusement_freeform", "emo_contentment_freeform", "emo_extasy_freeform"),
        ("Okay, I have to tell you about this, because it genuinely made my whole week.",
         "It's fast, it's simple, and the best part? You can try it free today."),
    ),
    Persona(
        "voice-leo", "Leo", "male", "Calm, Clear and Professional",
        ("emo_serenity_freeform", "emo_neutral_freeform", "emo_contentment_freeform"),
        ("Welcome. In this short lesson, we'll walk through the three steps you need to get started.",
         "Take your time with each one. There's no rush, and you can always come back to it later."),
    ),
    Persona(
        "voice-clara", "Clara", "female", "Warm Storyteller",
        ("emo_adoration_freeform", "emo_contentment_freeform", "emo_serenity_freeform"),
        ("The rain hadn't stopped for three days. She pulled her coat tighter, and finally, she knocked.",
         "And when the door opened, she smiled, because for the first time in years, she was home."),
    ),
    Persona(
        "voice-maya", "Maya", "female", "Confident Explainer",
        ("emo_pride_freeform", "emo_interest_freeform", "emo_neutral_freeform"),
        ("Here's the thing most people get wrong about saving money. It's not about earning more.",
         "It's about the small decisions you make every single day. Let me show you exactly what I mean."),
    ),
    Persona(
        "voice-rohan", "Rohan", "male", "Friendly and Conversational",
        ("freeform_speech_01", "freeform_speech_02", "freeform_speech_03"),
        ("Hey, so I was thinking about what you said yesterday, and you know what? You were totally right.",
         "Anyway, grab a coffee, sit down, and let's just figure this out together."),
    ),
]


def _speakers(gender: str) -> list[str]:
    stats = json.loads((EARS_DIR / "speaker_statistics.json").read_text())
    return sorted(p.name for p in EARS_DIR.iterdir() if p.is_dir() and stats.get(p.name, {}).get("gender") == gender)


def best_segment(path: Path) -> np.ndarray | None:
    """The best ~16 s of continuous, lively speech from a long recording:
    few long silences, steady level, plenty of pitch movement. Trimmed to
    start and end on speech."""
    audio, sr = librosa.load(path, sr=SR)
    if len(audio) < SR * (REF_SECONDS + 2):
        return None
    hop = SR // 2
    win = int(SR * REF_SECONDS)
    rms = librosa.feature.rms(y=audio, frame_length=1024, hop_length=256)[0]
    db = 20 * np.log10(rms + 1e-9)
    voiced = db > (np.percentile(db, 95) - 30)
    best, best_score = None, -1e9
    for start in range(int(SR * 1.0), len(audio) - win, hop):
        f0, f1 = start // 256, (start + win) // 256
        v = voiced[f0:f1]
        if len(v) == 0:
            continue
        # Longest silent run inside the window (seconds): long gaps teach the
        # model to hesitate.
        runs, cur = [], 0
        for x in v:
            cur = 0 if x else cur + 1
            runs.append(cur)
        longest_gap = max(runs) * 256 / SR
        score = v.mean() * 3 - max(0.0, longest_gap - 0.6) * 2
        if score > best_score:
            best, best_score = start, score
    seg = audio[best : best + win]
    _, (a, b) = librosa.effects.trim(seg, top_db=35)
    seg = seg[a:b]
    if len(seg) < SR * 10:
        return None
    return (seg / max(1e-6, float(np.max(np.abs(seg)))) * 0.9).astype(np.float32)


def _tighten(audio: np.ndarray, max_gap: float = 0.45) -> np.ndarray:
    """Trim edges and shorten silences longer than max_gap (spontaneous
    speech has thinking pauses the model would otherwise learn to copy)."""
    intervals = librosa.effects.split(audio, top_db=35, frame_length=1024, hop_length=256)
    if len(intervals) == 0:
        return audio[:0]
    parts, prev_end = [], None
    for a, b in intervals:
        if prev_end is not None:
            gap = min(a - prev_end, int(SR * max_gap))
            parts.append(audio[prev_end : prev_end + gap])
        parts.append(audio[a:b])
        prev_end = b
    return np.concatenate(parts)


def build_reference(speaker_dir: Path, sources: tuple[str, ...]) -> np.ndarray | None:
    """~16 s of one speaker performing the persona's style."""
    # Long monologues: pick the best continuous window.
    if sources[0].startswith("freeform_speech"):
        for src in sources:
            files = sorted(speaker_dir.glob(f"{src}*.wav"))
            if files and (seg := best_segment(files[0])) is not None:
                return seg
        return None
    # Short emotion recordings: chain the persona's moods, primary first.
    parts, total = [], 0.0
    for src in sources:
        for kind in dict.fromkeys((src, src.replace("_freeform", "_sentences"))):
            f = speaker_dir / f"{kind}.wav"
            if not f.exists():
                continue
            audio, _ = librosa.load(f, sr=SR)
            audio = _tighten(audio)
            if len(audio) < SR * 2:
                continue
            parts.append(audio)
            total += len(audio) / SR
            if total >= REF_SECONDS:
                break
        if total >= REF_SECONDS:
            break
    if total < 10:
        return None
    gap = np.zeros(int(SR * 0.3), np.float32)
    seg = np.concatenate([x for p in parts for x in (p, gap)][:-1])[: int(SR * (REF_SECONDS + 4))]
    return (seg / max(1e-6, float(np.max(np.abs(seg)))) * 0.9).astype(np.float32)


def audition(voice_id: str, lines: tuple[str, ...], mos_model) -> dict:
    mos, wers, moves, bright, wpms = [], [], [], [], []
    takes = []
    for line in lines:
        wav = _post_json("/tts", {"text": line, "voiceId": voice_id, "seed": 3})
        takes.append(wav)
        audio, sr = sf.read(io.BytesIO(wav), dtype="float32")
        with torch.inference_mode():
            a16 = librosa.resample(audio, orig_sr=sr, target_sr=16000)
            mos.append(float(mos_model(torch.from_numpy(a16).unsqueeze(0), 16000).item()))
        wers.append(_wer(line, _transcribe(wav)))
        moves.append(pitch_profile(audio, sr)[1])
        bright.append(_centroid(audio, sr))
        wpms.append(len(line.split()) / (len(audio) / sr) * 60)
    r = {
        "mos": float(np.mean(mos)),
        "wer": float(np.mean(wers)),
        "liveliness": float(np.mean(moves)),
        "brightness": float(np.mean(bright)),
        "wpm": float(np.mean(wpms)),
    }
    # Naturalness first; then liveliness, studio brightness (~1,950 Hz) and a
    # human pace (~165 wpm) — the measured gaps vs ElevenLabs.
    r["score"] = (
        r["mos"]
        - 3.0 * r["wer"]
        + 0.25 * min(r["liveliness"], 5.0)
        - abs(r["brightness"] - 1950) / 1500
        - max(0.0, r["wpm"] - 175) / 60
    )
    return r, takes


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("Loading UTMOS…", flush=True)
    mos_model = torch.hub.load("tarepan/SpeechMOS:v1.2.0", "utmos22_strong", trust_repo=True).eval()
    before = {g["id"] for g in generation_store.list_generations(limit=1_000_000)}

    table: dict[str, list[dict]] = {}
    t0 = time.time()
    for persona in PERSONAS:
        table[persona.voice_id] = []
        for spk in _speakers(persona.gender):
            seg = build_reference(EARS_DIR / spk, persona.sources)
            if seg is None:
                continue
            ref_path = OUT_DIR / f"{persona.voice_id}_{spk}.wav"
            sf.write(ref_path, seg, SR)
            cand_id = f"cand-{persona.voice_id}-{spk}"
            if voice_store.get_voice_metadata(cand_id):
                voice_store.delete_voice(cand_id)
            buf = io.BytesIO()
            sf.write(buf, seg, SR, format="WAV")
            voice_store.create_voice(cand_id, "candidate", buf.getvalue(), source="candidate", voice_id=cand_id, gender=persona.gender)
            try:
                r, takes = audition(cand_id, persona.lines, mos_model)
            except Exception as exc:  # noqa: BLE001
                print(f"  ✗ {persona.name} {spk}: {exc}", flush=True)
                continue
            finally:
                voice_store.delete_voice(cand_id)
            for i, wav in enumerate(takes):
                (OUT_DIR / f"{persona.voice_id}_{spk}_take{i + 1}.wav").write_bytes(wav)
            r.update(speaker=spk, ref=str(ref_path))
            table[persona.voice_id].append(r)
            print(
                f"  {persona.name:6s} {spk}  MOS {r['mos']:.2f}  WER {r['wer']:.2f}  live {r['liveliness']:.1f}  "
                f"bright {r['brightness']:4.0f}  {r['wpm']:3.0f} wpm  → {r['score']:.2f}   ({time.time() - t0:.0f}s)",
                flush=True,
            )

    for g in generation_store.list_generations(limit=1_000_000):
        if g["id"] not in before:
            generation_store.delete_generation(g["id"])
    (OUT_DIR / "results.json").write_text(json.dumps(table, indent=2))

    # Assign speakers greedily by best score, never reusing a speaker, so all
    # six voices are genuinely different people.
    pairs = sorted(
        ((r["score"], pid, r) for pid, rs in table.items() for r in rs), key=lambda x: x[0], reverse=True
    )
    used, chosen = set(), {}
    for _score, pid, r in pairs:
        if pid in chosen or r["speaker"] in used:
            continue
        chosen[pid] = r
        used.add(r["speaker"])

    if len(chosen) < len(PERSONAS):
        print("Not every persona found a speaker — library left unchanged.")
        return

    for meta in voice_store.list_voices():
        if meta["source"] in ("library", "candidate"):
            voice_store.delete_voice(meta["id"])
    print("\nNew library:")
    for persona in PERSONAS:
        r = chosen[persona.voice_id]
        voice_store.create_voice(
            persona.name,
            persona.title,
            Path(r["ref"]).read_bytes(),
            tags=[persona.title.split(",")[0].split(" ")[0].lower()],
            source="library",
            voice_id=persona.voice_id,
            gender=persona.gender,
            extra={"title": persona.title, "speaker": f"EARS {r['speaker']}", "mos": round(r["mos"], 2)},
        )
        print(
            f"  ★ {persona.name:6s} {persona.title:30s} EARS {r['speaker']}  MOS {r['mos']:.2f}  "
            f"live {r['liveliness']:.1f}  bright {r['brightness']:.0f}  {r['wpm']:.0f} wpm"
        )


if __name__ == "__main__":
    main()
