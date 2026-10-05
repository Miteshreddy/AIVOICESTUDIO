# KAIZ Studio

A private, fully local alternative to ElevenLabs. Everything runs on your own
NVIDIA GPU: no accounts, no API keys, no per-character billing, and nothing
leaves your machine.

| | |
|---|---|
| **Speech** | Type or paste up to 20,000 characters and pick a voice. Adjust stability, emotion and speed, then generate (Ctrl + Enter). |
| **Voices** | Six featured voices, each picked by audition from dozens of real human speakers. Plus **voice cloning** from an upload or a mic recording. |
| **Voice Changer** | Keep your words, timing and emotion, and swap the voice. |
| **Sound Effects** | Describe any sound and generate it. |
| **History** | Everything you've generated, searchable, with replay, download and "open in editor". |

## Run it

Double-click **`Start Voice Studio AI.bat`**. It starts three services and opens
http://localhost:5173:

- `ml-service/`: the Python voice engine (port 8095)
- `server/`: the Express API (port 8787)
- `client/`: the React app (port 5173)

The first launch takes about a minute while the voice model loads.

## Setup on a new machine

1. Install the voice engine. See [`ml-service/README.md`](ml-service/README.md).
2. Run `npm install` in the repo root.
3. Build the voice library once:
   ```bat
   cd ml-service
   G:\KAIZ_AI\venv\Scripts\python -m app.library --presets-only
   G:\KAIZ_AI\venv\Scripts\python -m app.curate_voices
   ```
   The voice engine must be running for `curate_voices`. It auditions real
   speakers and keeps the most natural three female and three male voices.

## Stack

React + Vite + Tailwind (client) · Express (API) · FastAPI + PyTorch (engine) ·
Chatterbox TTS / VC, Kokoro, faster-whisper and AudioLDM 2 (models).
