import { env } from "../config/env.js";
import { HttpError } from "../middleware/error-handler.js";

const BASE_URL = "https://api.elevenlabs.io/v1";

function requireKey() {
  if (!env.ELEVENLABS_API_KEY) {
    throw new HttpError(503, "ElevenLabs is not configured — set ELEVENLABS_API_KEY on the server.");
  }
  return env.ELEVENLABS_API_KEY;
}

export interface TtsRequest {
  voiceId: string;
  text: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
}

export async function generateSpeech({
  voiceId,
  text,
  stability = 0.5,
  similarityBoost = 0.75,
  style = 0,
  speed = 1,
}: TtsRequest): Promise<ArrayBuffer> {
  const apiKey = requireKey();

  const response = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability,
        similarity_boost: similarityBoost,
        style,
        speed,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new HttpError(response.status, "ElevenLabs TTS request failed", body);
  }

  return response.arrayBuffer();
}

export async function listVoices() {
  const apiKey = requireKey();
  const response = await fetch(`${BASE_URL}/voices`, {
    headers: { "xi-api-key": apiKey },
  });
  if (!response.ok) {
    throw new HttpError(response.status, "Failed to list ElevenLabs voices", await response.text());
  }
  return response.json();
}

export async function cloneVoice(name: string, description: string, files: Buffer[], filenames: string[]) {
  const apiKey = requireKey();

  const formData = new FormData();
  formData.append("name", name);
  formData.append("description", description);
  files.forEach((file, i) => {
    formData.append("files", new Blob([file]), filenames[i] ?? `sample-${i}.mp3`);
  });

  const response = await fetch(`${BASE_URL}/voices/add`, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: formData,
  });

  if (!response.ok) {
    throw new HttpError(response.status, "ElevenLabs voice cloning failed", await response.text());
  }

  return response.json();
}
