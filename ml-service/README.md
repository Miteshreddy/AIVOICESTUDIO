# KAIZ Voice Engine (ml-service)

Fully local, free voice engine — no accounts, no API keys, no cloud calls once
model weights are downloaded.

| Feature | Model | License |
|---|---|---|
| Cloned / narrator voices | [Chatterbox TTS](https://github.com/resemble-ai/chatterbox) | MIT |
| Preset voices (fast) | [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) | Apache-2.0 |
| Voice changer (speech-to-speech) | Chatterbox VC | MIT |
| Sound effects | [AudioLDM 2](https://huggingface.co/cvssp/audioldm2) | CC-BY-NC-SA 4.0 (non-commercial) |
| Transcription / clone segment picking | faster-whisper small | MIT |
| Narrator library recordings | LibriTTS-R | CC-BY-4.0 |

## What makes the speech sound human

- **Sentence-level synthesis** (`text_processing.py`) — long text is split into
  sentence chunks so prosody never flattens or drifts; short fragments are merged.
- **Punctuation-aware pauses** with a low room-tone bed instead of digital silence.
- **Automatic retake** — each chunk is length-checked against its text and
  re-sampled if the model mumbled, cut off, or repeated itself.
- **Expressive sampling** mapped from ElevenLabs-style Stability / Style controls.
- **Mastering** (`mastering.py`) — de-ess, -16 LUFS loudness, soft limiting, and
  Rubber Band (via ffmpeg) for artefact-free speed/pitch changes.
- **Expressive references** — library voices come from audiobook narration,
  and user clones are assembled from the clearest Whisper-verified segments
  of *all* uploaded samples (`clone_builder.py`).

## Setup (Windows, NVIDIA GPU)

Python 3.11 is required. The default install lives on `G:\KAIZ_AI` because C:
is nearly full; set `KAIZ_PYTHON` / `HF_HOME` to use other paths.

```bat
py -3.11 -m venv G:\KAIZ_AI\venv
G:\KAIZ_AI\venv\Scripts\pip install torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu124
G:\KAIZ_AI\venv\Scripts\pip install -r requirements.txt
G:\KAIZ_AI\venv\Scripts\pip install --force-reinstall --no-deps torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu124
```

`requirements.lock.txt` pins the exact tested versions. `ffmpeg` (full build,
with Rubber Band) and `espeak-ng` should be on PATH.

Build the narrator library once (~200 MB streamed):

```bat
set HF_HOME=G:\KAIZ_AI\hf
G:\KAIZ_AI\venv\Scripts\python -m app.library
```

Then start everything with `Start Voice Studio AI.bat` in the repo root.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | engine + per-model status |
| POST | `/tts` | `{text, voiceId?, stability, style, speed, pacing, pitchSemitones, brightness, warmth, seed}` → WAV |
| POST | `/voices/clone` | multipart `name`, `files[]` → voice + quality report |
| GET | `/voices`, `/voices/{id}`, `/voices/{id}/reference` | library / preview |
| POST | `/voice-changer` | multipart `voiceId`, `file`, `removeNoise` → WAV |
| POST | `/sound-effects` | `{prompt, durationSeconds, promptInfluence, quality, seed}` → WAV |
| POST | `/transcribe` | multipart `file` → text + segments |
| POST | `/audio/process` | cleanup chain |

On an 8 GB GPU, at most two heavy models (Chatterbox TTS, voice changer,
AudioLDM 2) stay resident; the least recently used one is unloaded automatically.
