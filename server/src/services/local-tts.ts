import http from "node:http";
import { env } from "../config/env.js";
import { HttpError } from "../middleware/error-handler.js";

const BASE_URL = new URL(env.LOCAL_TTS_URL);
const ENGINE_DOWN =
  "Couldn't reach the local voice engine — is it running? (start it with \"Start Voice Studio AI.bat\")";

interface EngineResponse {
  status: number;
  body: Buffer;
}

/**
 * Raw HTTP call to the Python engine. Uses node:http rather than fetch because
 * fetch's built-in 5-minute headers timeout is too short for long-form
 * narration or high-quality sound effects on a laptop GPU.
 */
function engineRequest(
  path: string,
  options: { method?: string; body?: Buffer | string; contentType?: string; timeoutMs?: number } = {},
): Promise<EngineResponse> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string | number> = {};
    if (options.body !== undefined) {
      headers["Content-Type"] = options.contentType ?? "application/json";
      headers["Content-Length"] = Buffer.byteLength(options.body);
    }
    const req = http.request(
      {
        hostname: BASE_URL.hostname,
        port: BASE_URL.port || 80,
        path,
        method: options.method ?? "GET",
        headers,
        timeout: options.timeoutMs ?? 0,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode ?? 500, body: Buffer.concat(chunks) }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", () => reject(new HttpError(503, ENGINE_DOWN)));
    if (options.body !== undefined) req.write(options.body);
    req.end();
  });
}

function assertOk(response: EngineResponse, action: string) {
  if (response.status >= 200 && response.status < 300) return;
  let detail = response.body.toString("utf8");
  try {
    detail = JSON.parse(detail).detail ?? detail;
  } catch {
    // keep raw text
  }
  if (typeof detail !== "string") detail = JSON.stringify(detail);
  const status = response.status === 404 ? 404 : response.status === 400 || response.status === 422 ? 400 : 502;
  throw new HttpError(status, status === 502 ? `Local voice engine ${action} failed: ${detail}` : detail);
}

async function json<T = unknown>(path: string, action: string, method = "GET", body?: unknown): Promise<T> {
  const response = await engineRequest(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assertOk(response, action);
  return JSON.parse(response.body.toString("utf8")) as T;
}

async function binary(path: string, action: string, method = "GET", body?: unknown): Promise<Buffer> {
  const response = await engineRequest(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assertOk(response, action);
  return response.body;
}

async function multipart(
  path: string,
  action: string,
  fields: Record<string, string | undefined>,
  files: { field: string; buffer: Buffer; filename: string }[],
): Promise<EngineResponse> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) form.append(key, value);
  for (const f of files) form.append(f.field, new Blob([new Uint8Array(f.buffer)]), f.filename);
  // Serialise the multipart body with the platform encoder, then send via node:http.
  const encoded = new Response(form);
  const body = Buffer.from(await encoded.arrayBuffer());
  const response = await engineRequest(path, {
    method: "POST",
    body,
    contentType: encoded.headers.get("content-type") ?? "multipart/form-data",
  });
  assertOk(response, action);
  return response;
}

// ── Text to speech ───────────────────────────────────────────────────────────

export interface LocalTtsRequest {
  voiceId: string;
  text: string;
  stability?: number;
  speed?: number;
  seed?: number;
  takes?: number;
  pitchSemitones?: number;
  brightness?: number;
  warmth?: number;
}

export function generateSpeechLocal(request: LocalTtsRequest) {
  return binary("/tts", "generation", "POST", request);
}

// ── Voices ───────────────────────────────────────────────────────────────────

export async function cloneVoiceLocal(
  name: string,
  description: string,
  files: { buffer: Buffer; filename: string }[],
) {
  const response = await multipart(
    "/voices/clone",
    "voice cloning",
    { name, description },
    files.map((f) => ({ field: "files", ...f })),
  );
  return JSON.parse(response.body.toString("utf8"));
}

export async function analyzeAudioLocal(file: Buffer, filename: string) {
  const response = await multipart("/analyze", "audio analysis", {}, [{ field: "file", buffer: file, filename }]);
  return JSON.parse(response.body.toString("utf8"));
}

export function listVoicesLocal() {
  return json("/voices", "voice listing");
}

export function deleteVoiceLocal(voiceId: string) {
  return json(`/voices/${encodeURIComponent(voiceId)}`, "voice deletion", "DELETE");
}

export interface VoiceUpdateFields {
  name?: string;
  description?: string;
  tags?: string[];
  speed?: number;
}

export function updateVoiceLocal(voiceId: string, fields: VoiceUpdateFields) {
  return json(`/voices/${encodeURIComponent(voiceId)}`, "voice update", "PATCH", fields);
}

export function getVoiceReferenceLocal(voiceId: string) {
  return binary(`/voices/${encodeURIComponent(voiceId)}/reference`, "voice preview");
}

// ── Voice changer / sound effects / transcription ────────────────────────────

export async function voiceChangerLocal(voiceId: string, file: Buffer, filename: string, removeNoise: boolean) {
  const response = await multipart(
    "/voice-changer",
    "voice conversion",
    { voiceId, removeNoise: String(removeNoise) },
    [{ field: "file", buffer: file, filename }],
  );
  return response.body;
}

export interface SoundEffectRequest {
  prompt: string;
  durationSeconds?: number;
  promptInfluence?: number;
  seed?: number;
  quality?: "draft" | "standard" | "high";
}

export function soundEffectLocal(request: SoundEffectRequest) {
  return binary("/sound-effects", "sound effect generation", "POST", request);
}

export async function transcribeLocal(file: Buffer, filename: string, language?: string) {
  const response = await multipart("/transcribe", "transcription", { language }, [
    { field: "file", buffer: file, filename },
  ]);
  return JSON.parse(response.body.toString("utf8"));
}

// ── Audio processing ─────────────────────────────────────────────────────────

export async function processAudioLocal(file: Buffer, filename: string, operations: unknown) {
  const response = await multipart("/audio/process", "audio processing", { operations: JSON.stringify(operations) }, [
    { field: "file", buffer: file, filename },
  ]);
  return response.body;
}

// ── Generation history ───────────────────────────────────────────────────────

export function listGenerationsLocal() {
  return json("/generations", "generation history listing");
}

export function getGenerationAudioLocal(generationId: string) {
  return binary(`/generations/${encodeURIComponent(generationId)}/audio`, "generation audio download");
}

export interface GenerationUpdateFields {
  favorite?: boolean;
  status?: string;
}

export function updateGenerationLocal(generationId: string, fields: GenerationUpdateFields) {
  return json(`/generations/${encodeURIComponent(generationId)}`, "generation update", "PATCH", fields);
}

export function deleteGenerationLocal(generationId: string) {
  return json(`/generations/${encodeURIComponent(generationId)}`, "generation deletion", "DELETE");
}

export async function localTtsHealth(): Promise<{ status: string; modelLoaded: boolean } | null> {
  try {
    const response = await engineRequest("/health", { timeoutMs: 2000 });
    if (response.status !== 200) return null;
    return JSON.parse(response.body.toString("utf8"));
  } catch {
    return null;
  }
}

// ── Pronunciation dictionary ─────────────────────────────────────────────────

export function getPronunciationsLocal() {
  return json<Record<string, string>>("/pronunciations", "pronunciation listing");
}

export function putPronunciationsLocal(entries: Record<string, string>) {
  return json<Record<string, string>>("/pronunciations", "pronunciation update", "PUT", entries);
}
