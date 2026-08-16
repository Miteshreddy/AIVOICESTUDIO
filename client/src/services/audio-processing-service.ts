import { apiClient } from "./api-client";
import type { CleanupOperation } from "@/features/audio-cleanup/store/audio-cleanup-store";

export interface AudioProcessOperations {
  noiseRemoval: CleanupOperation;
  echoRemoval: CleanupOperation;
  normalize: CleanupOperation;
  silenceRemoval: CleanupOperation;
  volumeLeveling: CleanupOperation;
  aiEnhancement: CleanupOperation;
  compressor: CleanupOperation;
  limiter: CleanupOperation;
  eqPreset: string;
}

export async function processAudio(file: File, operations: AudioProcessOperations): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("operations", JSON.stringify(operations));
  const blob = await apiClient.postBlob("/api/audio/process", undefined, formData);
  return URL.createObjectURL(blob);
}
