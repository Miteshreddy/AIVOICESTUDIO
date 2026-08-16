import { apiClient } from "./api-client";

export interface GenerateSpeechParams {
  voiceId?: string;
  text: string;
  exaggeration?: number;
  cfgWeight?: number;
  temperature?: number;
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
