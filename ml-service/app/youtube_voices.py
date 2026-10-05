"""Build many male YouTube-narration voices from real speakers.

For every male EARS speaker on disk, the reference is built from the
performances that sound like a YouTube narrator — engaged, excited, amazed
spontaneous speech plus fast-style reading — so Turbo copies an energetic,
forward delivery rather than slow, careful reading. Each candidate auditions
on YouTube-style lines and every speaker that clears the quality bar becomes
a voice, titled from its measured sound.

    python -m app.youtube_voices            (engine must be running on :8095)
"""

import io
import json
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

from . import generation_store, voice_store
from .personas import EARS_DIR, SR, audition, build_reference

OUT_DIR = Path(r"G:\KAIZ_AI\youtube")
PACE_WPM = 182.0  # YouTube narration sits around 170-190 wpm
SOURCES = (
    "emo_interest_freeform",
    "emo_amazement_freeform",
    "rainbow_01_fast",
    "rainbow_02_fast",
    "emo_extasy_freeform",
    "emo_pride_freeform",
)
LINES = (
    "This is the one trick nobody tells you about, and by the end of this video, you'll wonder how you ever lived without it.",
    "So let's break it down. Three steps, five minutes, and honestly? The results are kind of insane.",
)
# Plain first names; deliberately avoids ElevenLabs' premade-voice names.
NAMES = [
    "Marcus", "Ryan", "Kai", "Arjun", "Owen", "Caleb", "Dylan", "Mason", "Jordan", "Tyler",
    "Nathan", "Adrian", "Zane", "Victor", "Felix", "Hugo", "Dev", "Miles", "Theo", "Jasper",
]
MIN_MOS = 4.0
MAX_WER = 0.06


def _title(pitch: float, liveliness: float, brightness: float) -> str:
    tone = "Deep" if pitch < 110 else "Warm" if pitch < 130 else "Bright"
    energy = "High-Energy" if liveliness > 5.5 else "Punchy" if liveliness > 4 else "Smooth"
    role = "Explainer" if brightness > 1750 else "YouTube Narrator"
    return f"{tone}, {energy} {role}"


def unique_title(base: str, r: dict, used: set[str]) -> str:
    """Disambiguate same-sounding titles with another measured trait."""
    extras = [
        "Fast-Paced" if r["wpm"] > 188 else "Measured",
        "Crisp" if r["brightness"] > 1500 else "Rich",
        "Expressive" if r["liveliness"] > 5 else "Steady",
        "Lively" if r["liveliness"] > 4 else "Calm",
        "Low-Pitched" if r["pitch"] < 120 else "Mid-Pitched",
    ]
    if base not in used:
        return base
    for extra in extras:
        tone, rest = base.split(", ", 1)
        energy, role = rest.split(" ", 1)
        candidate = f"{tone}, {energy} and {extra} {role}"
        if candidate not in used:
            return candidate
    return base


def retitle_library() -> None:
    """Make every YouTube voice's title unique (idempotent)."""
    results = {r["speaker"]: r for r in json.loads((OUT_DIR / "results.json").read_text())}
    used: set[str] = set()
    for meta in sorted(voice_store.list_voices(), key=lambda v: v.get("mos", 0), reverse=True):
        spk = (meta.get("speaker") or "").replace("EARS ", "")
        if "youtube" not in meta.get("tags", []) or spk not in results:
            used.add(meta["description"])
            continue
        r = results[spk]
        title = unique_title(_title(r["pitch"], r["liveliness"], r["brightness"]), r, used)
        used.add(title)
        if title != meta["description"]:
            voice_store.update_voice(meta["id"], description=title)
            print(f"  retitled {meta['name']}: {title}")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stats = json.loads((EARS_DIR / "speaker_statistics.json").read_text())
    speakers = sorted(
        p.name for p in EARS_DIR.iterdir() if p.is_dir() and stats.get(p.name, {}).get("gender") == "male"
    )
    done_before = {r["speaker"] for r in json.loads((OUT_DIR / "results.json").read_text())} if (OUT_DIR / "results.json").exists() else set()
    taken = {v.get("speaker") for v in voice_store.list_voices()} | {f"EARS {s}" for s in done_before}
    speakers = [s for s in speakers if f"EARS {s}" not in taken]
    print(f"{len(speakers)} male speakers to audition: {' '.join(speakers)}", flush=True)

    print("Loading UTMOS…", flush=True)
    mos_model = torch.hub.load("tarepan/SpeechMOS:v1.2.0", "utmos22_strong", trust_repo=True).eval()
    before = {g["id"] for g in generation_store.list_generations(limit=1_000_000)}

    results, t0 = [], time.time()
    for spk in speakers:
        seg = build_reference(EARS_DIR / spk, SOURCES)
        if seg is None:
            print(f"  – {spk}: not enough material", flush=True)
            continue
        ref = OUT_DIR / f"{spk}.wav"
        sf.write(ref, seg, SR)
        cand = f"cand-yt-{spk}"
        if voice_store.get_voice_metadata(cand):
            voice_store.delete_voice(cand)
        buf = io.BytesIO()
        sf.write(buf, seg, SR, format="WAV")
        voice_store.create_voice(cand, "candidate", buf.getvalue(), source="candidate", voice_id=cand, gender="male",
                                 extra={"paceWpm": PACE_WPM})
        try:
            r, takes = audition(cand, LINES, mos_model)
        except Exception as exc:  # noqa: BLE001
            print(f"  ✗ {spk}: {exc}", flush=True)
            continue
        finally:
            voice_store.delete_voice(cand)
        from .library import pitch_profile

        r["pitch"] = pitch_profile(seg[: SR * 10])[0]
        for i, wav in enumerate(takes):
            (OUT_DIR / f"{spk}_take{i + 1}.wav").write_bytes(wav)
        r.update(speaker=spk, ref=str(ref))
        results.append(r)
        ok = r["mos"] >= MIN_MOS and r["wer"] <= MAX_WER
        print(
            f"  {'✓' if ok else '·'} {spk}  MOS {r['mos']:.2f}  WER {r['wer']:.2f}  live {r['liveliness']:.1f}  "
            f"bright {r['brightness']:4.0f}  {r['wpm']:3.0f} wpm  pitch {r['pitch']:.0f}   ({time.time() - t0:.0f}s)",
            flush=True,
        )

    for g in generation_store.list_generations(limit=1_000_000):
        if g["id"] not in before:
            generation_store.delete_generation(g["id"])
    previous = json.loads((OUT_DIR / "results.json").read_text()) if (OUT_DIR / "results.json").exists() else []
    (OUT_DIR / "results.json").write_text(json.dumps(previous + results, indent=2))

    keep = sorted((r for r in results if r["mos"] >= MIN_MOS and r["wer"] <= MAX_WER), key=lambda r: -r["mos"])
    used = {v["name"] for v in voice_store.list_voices()}
    names = [n for n in NAMES if n not in used]
    print(f"\nAdding {len(keep)} YouTube voices:")
    for name, r in zip(names, keep):
        title = _title(r["pitch"], r["liveliness"], r["brightness"])
        voice_store.create_voice(
            name,
            title,
            Path(r["ref"]).read_bytes(),
            tags=["youtube", "narration"],
            source="library",
            voice_id=f"voice-{name.lower()}",
            gender="male",
            extra={"title": title, "speaker": f"EARS {r['speaker']}", "mos": round(r["mos"], 2), "paceWpm": PACE_WPM},
        )
        print(f"  ★ {name:7s} {title:34s} EARS {r['speaker']}  MOS {r['mos']:.2f}  {r['wpm']:.0f} wpm")


if __name__ == "__main__":
    main()
    retitle_library()
