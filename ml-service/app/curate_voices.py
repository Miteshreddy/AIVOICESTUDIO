"""Audition real human speakers on Chatterbox-Turbo and keep the most human.

Each candidate speaks the same test lines through the *running* engine
(port 8095), and every take is scored on:

  * naturalness — UTMOS22 (neural MOS predictor)
  * liveliness  — pitch movement in semitones. Weighted heavily: a voice can
                  be perfectly clean and still sound robotic if it's flat.
  * clarity     — Whisper word error rate against the script

The top 3 female and top 3 male replace the library. Every candidate's takes
are kept in SHORTLIST_DIR so you can listen and overrule the scores.

    python -m app.curate_voices [--per-gender 12]
"""

import io
import json
import re
import sys
import time
import urllib.request
import uuid

import librosa
import numpy as np
import soundfile as sf
import torch

from . import generation_store, voice_store
from .library import CANDIDATES_DIR, gather, pitch_profile

ENGINE = "http://localhost:8095"
SHORTLIST_DIR = CANDIDATES_DIR.parent / "auditions"
TEST_LINES = [
    "Oh, hey! I honestly didn't think you'd make it tonight. Come in, come in, it's so good to see you.",
    "The old lighthouse had been dark for thirty years. But on the night of the storm, someone lit the lamp.",
    "Okay, so here's the plan. We finish the edit by Friday, ship it on Monday, and then, finally, we sleep.",
]
NAMES = {
    "female": [("Aria", "warm"), ("Maya", "bright"), ("Clara", "gentle")],
    "male": [("Ethan", "warm"), ("Leo", "rich"), ("Rohan", "easy-going")],
}


def _post_json(path: str, body: dict) -> bytes:
    req = urllib.request.Request(ENGINE + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=900) as r:
        return r.read()


def _transcribe(wav: bytes) -> str:
    boundary = uuid.uuid4().hex
    body = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.wav"\r\n'
        "Content-Type: audio/wav\r\n\r\n"
    ).encode() + wav + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        ENGINE + "/transcribe", data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )
    with urllib.request.urlopen(req, timeout=600) as r:
        return json.loads(r.read())["text"]


def _words(text: str) -> list[str]:
    return re.sub(r"[^a-z0-9' ]", " ", text.lower()).split()


def _wer(ref: str, hyp: str) -> float:
    r, h = _words(ref), _words(hyp)
    d = np.arange(len(h) + 1)
    for i, rw in enumerate(r, 1):
        prev, d[0] = d.copy(), i
        for j, hw in enumerate(h, 1):
            d[j] = min(prev[j] + 1, d[j - 1] + 1, prev[j - 1] + (rw != hw))
    return float(d[len(h)]) / max(1, len(r))


def audition(voice_id: str, speaker: str, mos_model) -> dict:
    mos, wers, moves = [], [], []
    takes = []
    for i, line in enumerate(TEST_LINES):
        wav = _post_json("/tts", {"text": line, "voiceId": voice_id, "seed": 7})
        takes.append(wav)
        audio, sr = sf.read(io.BytesIO(wav), dtype="float32")
        with torch.inference_mode():
            a16 = librosa.resample(audio, orig_sr=sr, target_sr=16000)
            mos.append(float(mos_model(torch.from_numpy(a16).unsqueeze(0), 16000).item()))
        wers.append(_wer(line, _transcribe(wav)))
        moves.append(pitch_profile(audio, sr)[1])
        (SHORTLIST_DIR / f"{speaker}_{i + 1}.wav").write_bytes(wav)
    m, w, live = float(np.mean(mos)), float(np.mean(wers)), float(np.mean(moves))
    # Liveliness counts as much as cleanliness, up to ~4.5 st (beyond = shouty).
    score = m - 3.0 * w + 0.35 * min(live, 4.5)
    return {"mos": m, "wer": w, "liveliness": live, "score": score}


def main():
    per_gender = 12
    if "--per-gender" in sys.argv:
        per_gender = int(sys.argv[sys.argv.index("--per-gender") + 1])

    print(f"Collecting {per_gender} lively speakers per gender (cached in {CANDIDATES_DIR})…", flush=True)
    candidates = gather(per_gender)
    print(f"{len(candidates)} candidates ready.", flush=True)

    print("Loading UTMOS naturalness predictor…", flush=True)
    mos_model = torch.hub.load("tarepan/SpeechMOS:v1.2.0", "utmos22_strong", trust_repo=True).eval()

    SHORTLIST_DIR.mkdir(parents=True, exist_ok=True)
    before = {g["id"] for g in generation_store.list_generations(limit=1_000_000)}
    results, t0 = [], time.time()
    for i, c in enumerate(candidates, 1):
        vid = f"cand-{c['speaker']}"
        ref = (CANDIDATES_DIR / f"{c['speaker']}.wav").read_bytes()
        if voice_store.get_voice_metadata(vid):
            voice_store.delete_voice(vid)
        voice_store.create_voice(vid, "candidate", ref, source="candidate", voice_id=vid, gender=c["gender"])
        try:
            r = audition(vid, c["speaker"], mos_model)
        except Exception as exc:  # noqa: BLE001
            print(f"  ✗ {vid}: {exc}", flush=True)
            continue
        results.append({**c, **r, "id": vid})
        print(
            f"  [{i}/{len(candidates)}] {c['speaker']:>5} {c['gender']:6s} MOS {r['mos']:.2f}  WER {r['wer']:.2f}  "
            f"live {r['liveliness']:.1f}st  → {r['score']:.2f}   ({time.time() - t0:.0f}s)",
            flush=True,
        )

    for g in generation_store.list_generations(limit=1_000_000):  # keep History clean
        if g["id"] not in before:
            generation_store.delete_generation(g["id"])
    (SHORTLIST_DIR / "results.json").write_text(json.dumps(results, indent=2))

    winners = {
        gender: sorted((r for r in results if r["gender"] == gender), key=lambda r: r["score"], reverse=True)[:3]
        for gender in ("female", "male")
    }
    if min(len(w) for w in winners.values()) < 3:
        print("Not enough candidates auditioned — library left unchanged.")
        return

    # Replace the whole built-in library (user clones are untouched).
    for meta in voice_store.list_voices():
        if meta["source"] in ("library", "candidate"):
            voice_store.delete_voice(meta["id"])

    print("\nNew library:")
    for gender, ws in winners.items():
        for (name, tone), w in zip(NAMES[gender], ws):
            ref = (CANDIDATES_DIR / f"{w['speaker']}.wav").read_bytes()
            voice_store.create_voice(
                name,
                f"Natural, {tone} {gender} voice",
                ref,
                tags=[tone],
                source="library",
                voice_id=f"voice-{name.lower()}",
                gender=gender,
                extra={"mos": round(w["mos"], 2), "liveliness": round(w["liveliness"], 2), "speaker": w["speaker"]},
            )
            print(f"  ★ {name:6s} {gender:6s} MOS {w['mos']:.2f}  WER {w['wer']:.2f}  live {w['liveliness']:.1f}  (speaker {w['speaker']})")


if __name__ == "__main__":
    main()
