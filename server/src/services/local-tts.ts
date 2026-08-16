import { env } from "../config/env.js";
import { HttpError } from "../middleware/error-handler.js";

const BASE_URL = env.LOCAL_TTS_URL;

export interface LocalTtsRequest {
  voiceId?: string;
  text: string;
  exaggeration?: number;
  cfgWeight?: number;
  temperature?: number;
}

async function assertOk(response: Response, action: string) {
  if (!response.ok) {
    let detail = await response.text();
    try {
      detail = JSON.parse(detail).detail ?? detail;
    } catch {
      // keep raw text
    }
    throw new HttpError(
      response.status === 404 ? 404 : 502,
      `Local TTS service ${action} failed: ${detail}`,
    );
  }
}

export async function generateSpeechLocal(request: LocalTtsRequest): Promise<ArrayBuffer> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new HttpError(
      503,
      "Couldn't reach the local TTS engine — is it running? (cd ml-service && python -m app.main)",
    );
  }
  await assertOk(response, "generation");
  return response.arrayBuffer();
}

export async function cloneVoiceLocal(name: string, description: string, file: Buffer, filename: string) {
  const formData = new FormData();
  formData.append("name", name);
  formData.append("description", description);
  formData.append("file", new Blob([file]), filename);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/voices/clone`, { method: "POST", body: formData });
  } catch {
    throw new HttpError(
      503,
      "Couldn't reach the local TTS engine — is it running? (cd ml-service && python -m app.main)",
    );
  }
  await assertOk(response, "voice cloning");
  return response.json();
}

export async function analyzeAudioLocal(file: Buffer, filename: string) {
  const formData = new FormData();
  formData.append("file", new Blob([file]), filename);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/analyze`, { method: "POST", body: formData });
  } catch {
    throw new HttpError(503, "Couldn't reach the local TTS engine.");
  }
  await assertOk(response, "audio analysis");
  return response.json();
}

export async function listVoicesLocal() {
  const response = await fetch(`${BASE_URL}/voices`);
  await assertOk(response, "voice listing");
  return response.json();
}

export async function deleteVoiceLocal(voiceId: string) {
  const response = await fetch(`${BASE_URL}/voices/${voiceId}`, { method: "DELETE" });
  await assertOk(response, "voice deletion");
  return response.json();
}

export interface VoiceUpdateFields {
  name?: string;
  description?: string;
  tags?: string[];
}

export async function updateVoiceLocal(voiceId: string, fields: VoiceUpdateFields) {
  const response = await fetch(`${BASE_URL}/voices/${voiceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  await assertOk(response, "voice update");
  return response.json();
}

export async function getVoiceReferenceLocal(voiceId: string): Promise<ArrayBuffer> {
  const response = await fetch(`${BASE_URL}/voices/${voiceId}/reference`);
  await assertOk(response, "voice reference download");
  return response.arrayBuffer();
}

export async function processAudioLocal(file: Buffer, filename: string, operations: unknown): Promise<ArrayBuffer> {
  const formData = new FormData();
  formData.append("file", new Blob([file]), filename);
  formData.append("operations", JSON.stringify(operations));

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/audio/process`, { method: "POST", body: formData });
  } catch {
    throw new HttpError(
      503,
      "Couldn't reach the local TTS engine — is it running? (cd ml-service && python -m app.main)",
    );
  }
  await assertOk(response, "audio processing");
  return response.arrayBuffer();
}

export async function listGenerationsLocal() {
  const response = await fetch(`${BASE_URL}/generations`);
  await assertOk(response, "generation history listing");
  return response.json();
}

export async function getGenerationAudioLocal(generationId: string): Promise<ArrayBuffer> {
  const response = await fetch(`${BASE_URL}/generations/${generationId}/audio`);
  await assertOk(response, "generation audio download");
  return response.arrayBuffer();
}

export interface GenerationUpdateFields {
  favorite?: boolean;
  status?: string;
}

export async function updateGenerationLocal(generationId: string, fields: GenerationUpdateFields) {
  const response = await fetch(`${BASE_URL}/generations/${generationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  await assertOk(response, "generation update");
  return response.json();
}

export async function deleteGenerationLocal(generationId: string) {
  const response = await fetch(`${BASE_URL}/generations/${generationId}`, { method: "DELETE" });
  await assertOk(response, "generation deletion");
  return response.json();
}

export async function localTtsHealth(): Promise<{ status: string; modelLoaded: boolean } | null> {
  try {
    const response = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) return null;
    return (await response.json()) as { status: string; modelLoaded: boolean };
  } catch {
    return null;
  }
}
