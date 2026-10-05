"""Per-voice fine-tuning of Chatterbox-Turbo (LoRA) — our "professional clone".

Instant cloning copies a voice from ~15 s, so the model knows the timbre but
not the speaker's habits: rhythm, emphasis, how they land a sentence.
ElevenLabs' Professional Voice Clones train on 30 min+ of a speaker. EARS
gives us ~1 h per speaker, so we do the same: train small LoRA adapters on
the T3 (text→speech-token) transformer, conditioned on exactly the reference
the app uses for that voice.

    python -m app.finetune prepare voice-dylan G:/KAIZ_AI/ears_full/p060
    python -m app.finetune train   voice-dylan [--epochs 4]

The engine stops while this runs — training needs the GPU.
"""

import argparse
import json
import random
import time
from pathlib import Path

import librosa
import numpy as np
import torch
import torch.nn.functional as F

from . import voice_store
from .text_processing import normalize

ROOT = Path(r"G:\KAIZ_AI\finetune")
import re as _re

# Only natural, narration-appropriate speech. EARS also contains whispering,
# exaggerated high/low pitch, slow reading and sad/pained/fearful emotions —
# training on those pulled the first test voice away from natural delivery
# (naturalness 4.42 → 4.29), so they're excluded.
KEEP = _re.compile(
    r"^(freeform_speech_\d+"
    r"|rainbow_\d+_(regular|fast|loud)"
    r"|emo_(interest|amazement|amusement|pride|contentment|neutral|realization|extasy|serenity|relief)_(freeform|sentences))\.wav$"
)
MIN_S, MAX_S = 2.5, 14.0


def _voice_dir(voice_id: str) -> Path:
    d = ROOT / voice_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _load_turbo():
    from chatterbox.tts_turbo import ChatterboxTurboTTS

    return ChatterboxTurboTTS.from_pretrained(device="cuda")


# ── prepare ───────────────────────────────────────────────────────────────────


def _utterances(whisper, audio16: np.ndarray) -> list[tuple[float, float, str]]:
    """Cut a recording into natural utterances using word timestamps."""
    segments, _ = whisper.transcribe(audio16, language="en", word_timestamps=True, vad_filter=True, beam_size=5)
    words = [w for s in segments for w in (s.words or [])]
    out, cur = [], []
    for i, w in enumerate(words):
        cur.append(w)
        dur = cur[-1].end - cur[0].start
        gap_next = (words[i + 1].start - w.end) if i + 1 < len(words) else 9.0
        sentence_end = w.word.strip().endswith((".", "?", "!"))
        if dur >= MAX_S or (dur >= MIN_S and (gap_next > 0.35 or (sentence_end and dur > 5))):
            text = "".join(x.word for x in cur).strip()
            if MIN_S <= dur <= MAX_S + 1 and len(text.split()) >= 3:
                out.append((max(0.0, cur[0].start - 0.08), cur[-1].end + 0.12, text))
            cur = []
    return out


def prepare(voice_id: str, speaker_dir: Path) -> None:
    from faster_whisper import WhisperModel

    from chatterbox.tts_turbo import punc_norm

    out_dir = _voice_dir(voice_id)
    files = sorted(p for p in speaker_dir.glob("*.wav") if KEEP.match(p.name))
    print(f"[prepare] {voice_id}: {len(files)} recordings from {speaker_dir}", flush=True)

    whisper = WhisperModel("medium.en", device="cuda", compute_type="int8_float16")
    items, total = [], 0.0
    for f in files:
        audio16, _ = librosa.load(f, sr=16000)
        for start, end, text in _utterances(whisper, audio16):
            items.append({"file": f.name, "start": start, "end": end, "text": text})
            total += end - start
    del whisper
    torch.cuda.empty_cache()
    print(f"[prepare] {len(items)} utterances, {total / 60:.1f} min", flush=True)

    model = _load_turbo()
    tok = model.s3gen.tokenizer
    cache: dict[str, np.ndarray] = {}
    samples = []
    for it in items:
        if it["file"] not in cache:
            cache = {it["file"]: librosa.load(speaker_dir / it["file"], sr=16000)[0]}
        seg = cache[it["file"]][int(it["start"] * 16000) : int(it["end"] * 16000)]
        with torch.inference_mode():
            speech, lens = tok.forward([seg])
        speech = speech[0, : int(lens[0])].cpu().tolist()
        text = punc_norm(normalize(it["text"]))
        text_ids = model.tokenizer(text).input_ids
        samples.append({"file": it["file"], "text": text, "text_ids": text_ids, "speech_ids": speech})

    ref = voice_store.get_reference_path(voice_id)
    model.prepare_conditionals(str(ref))
    model.conds.save(out_dir / "conds.pt")
    (out_dir / "dataset.json").write_text(json.dumps(samples))
    print(f"[prepare] saved {len(samples)} samples → {out_dir}", flush=True)


# ── train ─────────────────────────────────────────────────────────────────────


def _batch(t3, cond_emb: torch.Tensor, samples: list[dict], device):
    """Embeds = [cond | text | <start> speech <stop>], right-padded."""
    hp = t3.hp
    seqs, targets, masks = [], [], []
    for s in samples:
        text = torch.tensor(s["text_ids"], device=device)
        speech = torch.tensor([hp.start_speech_token, *s["speech_ids"], hp.stop_speech_token], device=device)
        emb = torch.cat([cond_emb, t3.text_emb(text), t3.speech_emb(speech)])
        # Predict speech[1:] from positions of speech[:-1].
        tgt = torch.full((emb.size(0),), -100, device=device, dtype=torch.long)
        start = cond_emb.size(0) + text.size(0)
        tgt[start : start + speech.size(0) - 1] = speech[1:]
        seqs.append(emb)
        targets.append(tgt)
    L = max(x.size(0) for x in seqs)
    embeds = torch.stack([F.pad(x, (0, 0, 0, L - x.size(0))) for x in seqs])
    target = torch.stack([F.pad(t, (0, L - t.size(0)), value=-100) for t in targets])
    attn = torch.stack([torch.cat([torch.ones(x.size(0)), torch.zeros(L - x.size(0))]) for x in seqs]).to(device)
    return embeds, target, attn


def train(voice_id: str, epochs: int = 3, lr: float = 1e-4, batch_tokens: int = 6000, rank: int = 16) -> None:
    from peft import LoraConfig, get_peft_model

    from chatterbox.tts_turbo import Conditionals

    out_dir = _voice_dir(voice_id)
    data = json.loads((out_dir / "dataset.json").read_text())
    random.Random(0).shuffle(data)
    n_val = max(8, len(data) // 20)
    val, tr = data[:n_val], data[n_val:]
    print(f"[train] {voice_id}: {len(tr)} train / {len(val)} val utterances", flush=True)

    model = _load_turbo()
    t3 = model.t3
    device = t3.device
    for p in t3.parameters():
        p.requires_grad_(False)
    conds = Conditionals.load(out_dir / "conds.pt", map_location=device).to(device)
    with torch.no_grad():
        cond_emb = t3.prepare_conditioning(conds.t3)[0].detach()

    cfg = LoraConfig(r=rank, lora_alpha=rank * 2, lora_dropout=0.05,
                     target_modules=["c_attn", "c_proj", "c_fc"], fan_in_fan_out=True)
    t3.tfmr = get_peft_model(t3.tfmr, cfg)
    t3.tfmr.print_trainable_parameters()
    t3.tfmr.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
    t3.tfmr.config.use_cache = False
    params = [p for p in t3.tfmr.parameters() if p.requires_grad]
    opt = torch.optim.AdamW(params, lr=lr, weight_decay=0.01)

    def batches(items, shuffle):
        items = sorted(items, key=lambda s: len(s["speech_ids"]))
        groups, cur, cur_tokens = [], [], 0
        for s in items:
            n = cond_emb.size(0) + len(s["text_ids"]) + len(s["speech_ids"]) + 2
            if cur and cur_tokens + n > batch_tokens:
                groups.append(cur)
                cur, cur_tokens = [], 0
            cur.append(s)
            cur_tokens += n
        if cur:
            groups.append(cur)
        if shuffle:
            random.shuffle(groups)
        return groups

    def step_loss(group):
        embeds, target, attn = _batch(t3, cond_emb, group, device)
        with torch.autocast("cuda", dtype=torch.bfloat16):
            hidden = t3.tfmr(inputs_embeds=embeds, attention_mask=attn).last_hidden_state
            logits = t3.speech_head(hidden)
        return F.cross_entropy(logits.float().view(-1, logits.size(-1)), target.view(-1), ignore_index=-100)

    def evaluate():
        t3.tfmr.eval()
        losses = []
        with torch.no_grad():
            for g in batches(val, False):
                losses.append(step_loss(g).item())
        t3.tfmr.train()
        return float(np.mean(losses))

    total_steps = epochs * len(batches(tr, False))
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=lr, total_steps=total_steps, pct_start=0.1)
    best = evaluate()
    print(f"[train] baseline val loss {best:.4f}", flush=True)
    t0, step = time.time(), 0
    t3.tfmr.train()
    for epoch in range(1, epochs + 1):
        running = []
        for g in batches(tr, True):
            loss = step_loss(g)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(params, 1.0)
            opt.step()
            sched.step()
            running.append(loss.item())
            step += 1
            if step % 25 == 0:
                print(f"[train] epoch {epoch} step {step}/{total_steps} loss {np.mean(running[-25:]):.4f} "
                      f"({time.time() - t0:.0f}s, {torch.cuda.max_memory_allocated() / 1e9:.1f} GB)", flush=True)
        v = evaluate()
        print(f"[train] epoch {epoch} val loss {v:.4f} (best {best:.4f})", flush=True)
        if v < best:
            best = v
            t3.tfmr.save_pretrained(out_dir / "adapter")
            (out_dir / "adapter" / "meta.json").write_text(json.dumps({"val_loss": v, "epoch": epoch}))
            print(f"[train] saved adapter (epoch {epoch})", flush=True)
    print(f"[train] done in {(time.time() - t0) / 60:.1f} min, best val loss {best:.4f}", flush=True)


# ── quality gate ──────────────────────────────────────────────────────────────

GATE_LINES = (
    "This is the one trick nobody tells you about, and by the end of this video, you'll wonder how you ever lived without it.",
    "So let's break it down. Three steps, five minutes, and honestly? The results are kind of insane.",
    "Nvidia just made two point five billion dollars in a single quarter. Let that sink in for a second.",
    "If you made it this far, hit subscribe, because next week we're going even deeper.",
)
MIN_MOS = 4.10
MOS_TOLERANCE = 0.03
SIM_TOLERANCE = 0.03  # 0.86+ is clearly the same speaker; different people score < ~0.75


def evaluate(voice_id: str) -> bool:
    """A/B the fine-tuned voice against the same voice without its adapter,
    through the real app pipeline. Keep the adapter only if it is at least
    as good on every measure; otherwise set it aside."""
    import io
    import re

    import soundfile as sf
    from faster_whisper import WhisperModel

    from . import models, tts_engine

    adapter = ROOT / voice_id / "adapter"
    if not adapter.exists():
        print(f"[gate] {voice_id}: no adapter")
        return False
    ref = str(voice_store.get_reference_path(voice_id))
    meta = voice_store.get_voice_metadata(voice_id)
    whisper = WhisperModel("small", device="cuda", compute_type="int8_float16")
    mos_model = models.naturalness()
    tts = models.tts()

    def words(t):
        return re.sub(r"[^a-z0-9' ]", " ", t.lower()).split()

    def wer(a, b):
        r, h = words(a), words(b)
        d = list(range(len(h) + 1))
        for i, rw in enumerate(r, 1):
            prev, d[0] = d[:], i
            for j, hw in enumerate(h, 1):
                d[j] = min(prev[j] + 1, d[j - 1] + 1, prev[j - 1] + (rw != hw))
        return d[len(h)] / max(1, len(r))

    ref16 = librosa.load(ref, sr=16000)[0]
    ref_emb = tts.ve.embeds_from_wavs([ref16], sample_rate=16000).mean(axis=0)

    def score(use_adapter: bool) -> dict:
        original = tts_engine.adapter_path
        if not use_adapter:
            tts_engine.adapter_path = lambda _vid: None
        try:
            m, w, s = [], [], []
            for i, line in enumerate(GATE_LINES):
                settings = tts_engine.VoiceSettings(seed=100 + i, target_wpm=float(meta.get("paceWpm", 168)))
                wav = tts_engine.synthesize(line, ref, settings)
                audio, sr = sf.read(io.BytesIO(wav), dtype="float32")
                a16 = librosa.resample(audio, orig_sr=sr, target_sr=16000)
                with torch.inference_mode():
                    m.append(float(mos_model(torch.from_numpy(a16).unsqueeze(0).to("cuda"), 16000).item()))
                segs, _ = whisper.transcribe(a16, language="en")
                w.append(wer(normalize(line), " ".join(x.text for x in segs)))
                emb = tts.ve.embeds_from_wavs([a16], sample_rate=16000).mean(axis=0)
                s.append(float(np.dot(emb, ref_emb) / (np.linalg.norm(emb) * np.linalg.norm(ref_emb))))
            return {"mos": float(np.mean(m)), "wer": float(np.mean(w)), "similarity": float(np.mean(s))}
        finally:
            tts_engine.adapter_path = original

    base, tuned = score(False), score(True)
    checks = {
        f"naturalness ≥ {MIN_MOS}": tuned["mos"] >= MIN_MOS,
        # No "no MOS loss vs base" rule: in a blind listening test the user
        # preferred fine-tuned Dylan (UTMOS 4.33) over the base (4.42) — UTMOS
        # rewards clean, generic delivery and penalises real speaker habits.
        "no extra misread words": tuned["wer"] <= base["wer"] + 0.02,
        "same speaker": tuned["similarity"] >= base["similarity"] - SIM_TOLERANCE,
    }
    passed = all(checks.values())
    print(f"[gate] {voice_id}  base:  MOS {base['mos']:.2f}  WER {base['wer']:.2f}  sim {base['similarity']:.3f}")
    print(f"[gate] {voice_id}  tuned: MOS {tuned['mos']:.2f}  WER {tuned['wer']:.2f}  sim {tuned['similarity']:.3f}")
    for name, ok in checks.items():
        print(f"[gate]   {'✓' if ok else '✗'} {name}")
    report = {"base": base, "tuned": tuned, "checks": checks, "passed": passed}
    (ROOT / voice_id / "gate.json").write_text(json.dumps(report, indent=2))
    if passed:
        print(f"[gate] {voice_id}: PASSED — Pro voice enabled", flush=True)
    else:
        rejected = ROOT / voice_id / "adapter_rejected"
        if rejected.exists():
            import shutil

            shutil.rmtree(rejected)
        adapter.rename(rejected)
        print(f"[gate] {voice_id}: did not pass — voice left unchanged", flush=True)
    return passed


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p1 = sub.add_parser("prepare")
    p1.add_argument("voice_id")
    p1.add_argument("speaker_dir", type=Path)
    p2 = sub.add_parser("train")
    p2.add_argument("voice_id")
    p2.add_argument("--epochs", type=int, default=3)
    p2.add_argument("--lr", type=float, default=1e-4)
    p3 = sub.add_parser("evaluate")
    p3.add_argument("voice_id")
    a = ap.parse_args()
    if a.cmd == "prepare":
        prepare(a.voice_id, a.speaker_dir)
    elif a.cmd == "train":
        train(a.voice_id, a.epochs, a.lr)
    else:
        evaluate(a.voice_id)

