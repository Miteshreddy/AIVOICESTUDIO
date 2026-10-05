"""Builds the best possible zero-shot reference clip from user uploads.

Chatterbox conditions on only the first ~6 s (prosody/style, T3) and ~10 s
(timbre, S3Gen) of its reference. So clone quality is decided almost entirely
by *which* 10-15 seconds we hand it. Instead of "take the biggest file", we:

  1. decode every uploaded sample (any format ffmpeg/libsndfile reads),
  2. denoise each one if it's noisy,
  3. transcribe with Whisper to find real speech segments + their confidence,
  4. rank segments (ASR confidence, loudness, no music/noise, sensible length),
  5. stitch the best ones (in original order) into a ~15 s reference,
  6. report quality and concrete warnings back to the user.
"""

import io
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

import librosa
import numpy as np
import pyloudnorm as pyln
import soundfile as sf

from . import models
from .audio_processing import apply_noise_reduction
from .tts_engine import analyze_audio

WORK_SR = 24000
TARGET_REFERENCE_S = 15.0
MIN_TOTAL_SPEECH_S = 5.0


@dataclass
class Segment:
    audio: np.ndarray
    text: str
    score: float
    source: int
    start: float


def decode_any(audio_bytes: bytes, filename: str = "") -> tuple[np.ndarray, int]:
    try:
        data, sr = sf.read(io.BytesIO(audio_bytes), dtype="float32", always_2d=False)
    except Exception:  # noqa: BLE001 — mp3/m4a/webm etc. → ffmpeg
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            raise
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / (Path(filename).name or "input")
            dst = Path(tmp) / "out.wav"
            src.write_bytes(audio_bytes)
            subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(src), "-ac", "1", str(dst)], check=True)
            data, sr = sf.read(dst, dtype="float32")
    if data.ndim > 1:
        data = data.mean(axis=1)
    return data, sr


def _segments_for(audio: np.ndarray, source_idx: int) -> tuple[list[Segment], str]:
    whisper = models.whisper()
    audio16 = librosa.resample(audio, orig_sr=WORK_SR, target_sr=16000)
    result, _info = whisper.transcribe(audio16, vad_filter=True, beam_size=1, word_timestamps=False)
    segments, transcript = [], []
    for seg in result:
        transcript.append(seg.text.strip())
        dur = seg.end - seg.start
        if dur < 1.0:
            continue
        clip = audio[int(seg.start * WORK_SR) : int(seg.end * WORK_SR)]
        rms = float(np.sqrt(np.mean(clip**2))) if len(clip) else 0.0
        score = (
            float(np.exp(seg.avg_logprob))  # ASR confidence ≈ clear articulation
            - seg.no_speech_prob
            - max(0.0, seg.compression_ratio - 2.4)  # repeated junk/music
            + min(dur, 8.0) / 16  # prefer full sentences
            - (0.3 if rms < 0.01 else 0.0)
        )
        segments.append(Segment(clip, seg.text.strip(), score, source_idx, seg.start))
    return segments, " ".join(transcript)


def build_reference(files: list[tuple[bytes, str]]) -> dict:
    warnings: list[str] = []
    all_segments: list[Segment] = []
    transcripts: list[str] = []
    analyses = []
    total_input_s = 0.0

    for idx, (raw, name) in enumerate(files):
        audio, sr = decode_any(raw, name)
        audio = librosa.resample(audio, orig_sr=sr, target_sr=WORK_SR) if sr != WORK_SR else audio
        total_input_s += len(audio) / WORK_SR

        buf = io.BytesIO()
        sf.write(buf, audio, WORK_SR, format="WAV")
        analysis = analyze_audio(buf.getvalue())
        analyses.append(analysis)

        if analysis["clippingDetected"]:
            warnings.append(f"“{name}” is clipping/distorted — record a little quieter.")
        if analysis["noiseLevel"] > 35:
            audio = apply_noise_reduction(audio, WORK_SR, min(80, analysis["noiseLevel"] * 1.2))
            warnings.append(f"“{name}” had background noise; it was cleaned automatically.")

        segments, transcript = _segments_for(audio, idx)
        all_segments.extend(segments)
        transcripts.append(transcript)

    speech_s = sum(len(s.audio) for s in all_segments) / WORK_SR
    if speech_s < MIN_TOTAL_SPEECH_S:
        raise ValueError(
            f"Only {speech_s:.1f}s of clear speech was found. Upload at least 10 seconds of a single "
            "speaker talking naturally, with no music behind them."
        )

    # Pick the best segments until we have enough, then restore original order
    # so the reference keeps natural sentence-to-sentence flow.
    ranked = sorted(all_segments, key=lambda s: s.score, reverse=True)
    chosen, total = [], 0.0
    for seg in ranked:
        if total >= TARGET_REFERENCE_S:
            break
        chosen.append(seg)
        total += len(seg.audio) / WORK_SR
    # Best segment first — Chatterbox reads style from the opening seconds.
    best = chosen[0]
    rest = sorted(chosen[1:], key=lambda s: (s.source, s.start))
    ordered = [best, *rest]

    gap = np.zeros(int(WORK_SR * 0.25), dtype=np.float32)
    pieces = []
    for seg in ordered:
        pieces.extend([seg.audio, gap])
    reference = np.concatenate(pieces[:-1])

    meter = pyln.Meter(WORK_SR)
    loud = meter.integrated_loudness(reference)
    if np.isfinite(loud):
        reference = pyln.normalize.loudness(reference, loud, -20.0)
    peak = float(np.max(np.abs(reference)))
    if peak > 0.95:
        reference = reference / peak * 0.95

    if total_input_s < 20:
        warnings.append("Tip: 30-90 seconds of varied, expressive speech gives a noticeably better clone.")

    avg_conf = float(np.mean([s.score for s in chosen]))
    quality = int(np.clip(avg_conf * 70 + min(speech_s, 60) / 60 * 30, 0, 100))

    buf = io.BytesIO()
    sf.write(buf, reference.astype(np.float32), WORK_SR, format="WAV")
    return {
        "reference": buf.getvalue(),
        "transcript": " ".join(t for t in transcripts if t),
        "speechSeconds": round(speech_s, 1),
        "referenceSeconds": round(len(reference) / WORK_SR, 1),
        "qualityScore": quality,
        "warnings": warnings,
        "analysis": analyses[0] if len(analyses) == 1 else {
            **analyses[0],
            "durationSeconds": round(total_input_s, 2),
            "clarityScore": int(np.mean([a["clarityScore"] for a in analyses])),
            "noiseLevel": int(np.mean([a["noiseLevel"] for a in analyses])),
            "clippingDetected": any(a["clippingDetected"] for a in analyses),
        },
    }
