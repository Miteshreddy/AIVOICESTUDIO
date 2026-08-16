# Voice Studio AI — Local TTS Engine

A self-hosted voice cloning + text-to-speech service using [Chatterbox TTS](https://github.com/resemble-ai/chatterbox) (MIT licensed). Runs entirely on your machine — no API keys, no cloud calls.

## Setup

```bash
cd ml-service
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
python -m app.main
```

First run downloads the Chatterbox model weights (~a few GB) from Hugging Face and caches them locally. Requires an NVIDIA GPU with CUDA for reasonable speed — set `ML_SERVICE_DEVICE=cpu` to force CPU (slow).

The service listens on `http://localhost:8095` by default (override with `ML_SERVICE_PORT`).

## Endpoints

- `GET /health` — service + model status
- `POST /voices/clone` — multipart `{ name, description, file }` → stores a reference sample, returns `{ id, analysis }`
- `GET /voices` / `GET /voices/{id}` / `DELETE /voices/{id}`
- `POST /analyze` — multipart `{ file }` → duration, clarity/noise heuristics
- `POST /tts` — JSON `{ text, voiceId?, exaggeration?, cfgWeight?, temperature? }` → returns `audio/wav`. Omit `voiceId` to use the model's default voice.

The Node API (`server/`) calls this service directly — see `server/src/services/local-tts.ts`.
