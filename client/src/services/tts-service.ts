import { apiClient } from "./api-client";

export interface GenerateSpeechParams {
  voiceId: string;
  text: string;
  /** 0 = more natural variation, 1 = steadier and more consistent */
  stability?: number;
  /** 0.5 - 2.0 speaking-rate multiplier */
  speed?: number;
  /** takes per passage (best is kept) */
  takes?: number;
  pitchSemitones?: number;
  brightness?: number;
  warmth?: number;
  seed?: number;
}

export async function generateSpeechAudio(params: GenerateSpeechParams): Promise<string> {
  const blob = await apiClient.postBlob("/api/tts/generate", params);
  return URL.createObjectURL(blob);
}

export interface ClonedVoiceAnalysis {
  durationSeconds: number;
  sampleRate: number;
  clarityScore: number;
  noiseLevel: number;
  peakAmplitude: number;
  clippingDetected: boolean;
}

export type VoiceSource = "library" | "user";

export interface ClonedVoice {
  id: string;
  name: string;
  description: string;
  tags: string[];
  gender: string | null;
  source: VoiceSource;
  generationCount: number;
  createdAt: string;
  updatedAt: string;
  analysis: ClonedVoiceAnalysis;
  qualityScore?: number;
  warnings?: string[];
  speechSeconds?: number;
}

export function analyzeVoiceSample(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient.postForm<ClonedVoiceAnalysis>("/api/voices/analyze", formData);
}

export function cloneVoiceRequest(name: string, description: string, files: File[]) {
  const formData = new FormData();
  formData.append("name", name);
  formData.append("description", description);
  files.forEach((file) => formData.append("files", file));
  return apiClient.postForm<ClonedVoice>("/api/voices/clone", formData);
}

export interface RemoteVoiceSummary {
  id: string;
  name: string;
  description: string;
  tags: string[];
  gender: string | null;
  source: VoiceSource;
  featured?: boolean;
  /** Fine-tuned on ~1 h of the speaker ("Pro" voice). */
  fineTuned?: boolean;
  qualityScore?: number;
  generationCount: number;
  createdAt: string;
  updatedAt: string;
}

export function listClonedVoices() {
  return apiClient.get<RemoteVoiceSummary[]>("/api/voices");
}

export function deleteClonedVoice(voiceId: string) {
  return apiClient.delete<{ deleted: string }>(`/api/voices/${voiceId}`);
}

export interface VoiceUpdateFields {
  name?: string;
  description?: string;
  tags?: string[];
}

export function updateClonedVoice(voiceId: string, fields: VoiceUpdateFields) {
  return apiClient.patch<RemoteVoiceSummary>(`/api/voices/${voiceId}`, fields);
}

export async function downloadVoiceReference(voiceId: string): Promise<string> {
  const blob = await apiClient.getBlob(`/api/voices/${voiceId}/reference`);
  return URL.createObjectURL(blob);
}

export type GenerationStatus = "ready" | "archived";

export interface GenerationRecord {
  id: string;
  voiceId: string | null;
  voiceName: string;
  text: string;
  durationSeconds: number;
  status: GenerationStatus;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export function listGenerations() {
  return apiClient.get<GenerationRecord[]>("/api/generations");
}

export async function downloadGenerationAudio(generationId: string): Promise<string> {
  const blob = await apiClient.getBlob(`/api/generations/${generationId}/audio`);
  return URL.createObjectURL(blob);
}

export interface GenerationUpdateFields {
  favorite?: boolean;
  status?: GenerationStatus;
}

export function updateGeneration(generationId: string, fields: GenerationUpdateFields) {
  return apiClient.patch<GenerationRecord>(`/api/generations/${generationId}`, fields);
}

export function deleteGeneration(generationId: string) {
  return apiClient.delete<{ deleted: string }>(`/api/generations/${generationId}`);
}

export interface SoundEffectParams {
  prompt: string;
  durationSeconds?: number;
  promptInfluence?: number;
  quality?: "draft" | "standard" | "high";
  seed?: number;
}

export async function generateSoundEffect(params: SoundEffectParams): Promise<string> {
  const blob = await apiClient.postBlob("/api/sound-effects/generate", params);
  return URL.createObjectURL(blob);
}

export async function convertVoice(file: File | Blob, voiceId: string, removeNoise: boolean): Promise<string> {
  const formData = new FormData();
  formData.append("voiceId", voiceId);
  formData.append("removeNoise", String(removeNoise));
  formData.append("file", file, file instanceof File ? file.name : "recording.webm");
  const blob = await apiClient.postFormBlob("/api/voice-changer/convert", formData);
  return URL.createObjectURL(blob);
}

export function getPronunciations() {
  return apiClient.get<Record<string, string>>("/api/pronunciations");
}

export function savePronunciations(entries: Record<string, string>) {
  return apiClient.put<Record<string, string>>("/api/pronunciations", entries);
}
