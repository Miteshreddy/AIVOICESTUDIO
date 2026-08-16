# Voice Studio AI

A complete AI voice creation, editing, cloning, and production platform — built to feel like Figma, Cursor, ElevenLabs, Adobe Audition, and CapCut combined.

Voice generation and cloning run **entirely locally** on your own GPU via [Chatterbox TTS](https://github.com/resemble-ai/chatterbox) (MIT licensed) — no ElevenLabs/OpenAI account or API key required to clone a voice and generate speech.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS, Framer Motion, shadcn/ui, React Router, React Query, Zustand |
| Backend | Node.js, Express |
| Voice engine | Python, FastAPI, [Chatterbox TTS](https://github.com/resemble-ai/chatterbox) — self-hosted, GPU-accelerated |
| Database / Auth / Storage | Supabase (optional — see below) |
| Optional AI | OpenAI/Groq (text rewrite tools), Deepgram (transcription), ElevenLabs (alternate cloud TTS provider) |
| Deployment | Vercel (client), Railway (server) |

## Structure

This is an npm-workspaces monorepo plus one Python service:

- `client/` — React app, feature-based architecture (`src/features/*`)
- `server/` — Express API layer; proxies the local TTS engine and any optional cloud AI providers
- `ml-service/` — Python FastAPI service running Chatterbox TTS locally

See `client/src/` subfolders for the full frontend architecture breakdown, and [`ml-service/README.md`](ml-service/README.md) for the voice engine.

## Getting started

```bash
# 1. Voice engine (needs an NVIDIA GPU with CUDA for reasonable speed)
cd ml-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124 --force-reinstall  # GPU build
python -m app.main                 # http://localhost:8095 — first run downloads model weights (~5GB)

# 2. App (from repo root, separate terminal)
npm install
cp .env.example .env
npm run dev                        # client on http://localhost:5173
npm run dev:server                 # API on http://localhost:8787
```

Without a Supabase project configured, the API runs in **local single-user mode** — no sign-in required, everything works against local storage. Add `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` when you want real accounts, multi-user data, and persistence.

### Database (optional)

Apply the schema in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) to your Supabase project (via `supabase db push` with the Supabase CLI, or by pasting it into the SQL editor). It creates `profiles`, `voices`, `projects`, `generations`, and `user_api_keys` tables with row-level security, plus `voice-samples` / `generated-audio` / `avatars` storage buckets.

## Deployment

The voice engine (`ml-service/`) needs a GPU host — Vercel/Railway won't run it. Options: keep it local and only deploy the client (point `VITE_API_BASE_URL` at a tunnel to your machine), rent a GPU box (RunPod/Lambda/etc.) and point `LOCAL_TTS_URL` at it, or switch `TTS_PROVIDER=elevenlabs` server-side to fall back to the cloud provider for production instead.

- **Client → Vercel**: import the repo as-is. [`vercel.json`](vercel.json) at the repo root points Vercel at the `client` workspace (`npm run build --workspace=client`, output `client/dist`) and adds a SPA rewrite so client-side routes resolve correctly. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_BASE_URL` as project env vars.
- **Server → Railway**: import the repo, keep the service root directory at the repo root. [`railway.json`](railway.json) builds and starts the `server` workspace and health-checks `/health`. Set `LOCAL_TTS_URL` (or `TTS_PROVIDER=elevenlabs` + `ELEVENLABS_API_KEY`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`, and `CORS_ORIGIN` as project env vars.

## Status

Built incrementally, feature by feature. See task list for current progress.
