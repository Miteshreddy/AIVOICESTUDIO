import { create } from "zustand";
import { toast } from "sonner";
import { analyzeVoiceSample, cloneVoiceRequest } from "@/services/tts-service";
import { ApiError } from "@/services/api-client";
import { useRealVoicesStore } from "@/store/real-voices-store";

export type CloneStep = "upload" | "analyzing" | "review" | "training" | "complete";

export interface CloneAnalysis {
  durationSeconds: number;
  noiseLevel: number;
  clarityScore: number;
  qualityScore: number;
  warnings: string[];
}

interface VoiceCloneState {
  step: CloneStep;
  files: File[];
  analysis: CloneAnalysis | null;
  trainingProgress: number;
  clonedVoiceId: string | null;
  error: string | null;
  addFiles: (files: File[]) => void;
  removeFile: (name: string) => void;
  startAnalysis: () => Promise<void>;
  startTraining: (voiceName: string) => Promise<void>;
  reset: () => void;
}

export const useVoiceCloneStore = create<VoiceCloneState>((set, get) => ({
  step: "upload",
  files: [],
  analysis: null,
  trainingProgress: 0,
  clonedVoiceId: null,
  error: null,

  addFiles: (files) => set({ files: [...get().files, ...files] }),
  removeFile: (name) => set({ files: get().files.filter((f) => f.name !== name) }),

  startAnalysis: async () => {
    const { files } = get();
    if (files.length === 0) return;
    set({ step: "analyzing", error: null });

    try {
      // Chatterbox clones zero-shot from a single reference clip — analyze the longest sample.
      const primary = files.reduce((a, b) => (b.size > a.size ? b : a));
      const result = await analyzeVoiceSample(primary);

      const durationScore = Math.min(100, Math.round((result.durationSeconds / 30) * 100));
      const qualityScore = Math.round(
        result.clarityScore * 0.5 + durationScore * 0.35 + (100 - result.noiseLevel) * 0.15,
      );

      const warnings: string[] = [];
      if (result.durationSeconds < 6)
        warnings.push("Under 6 seconds of audio — provide at least 6–30s for a reliable clone.");
      if (result.noiseLevel > 30)
        warnings.push("Background noise detected — consider re-recording in a quieter space.");
      if (result.clippingDetected) warnings.push("Clipping detected — the sample may sound distorted.");

      set({
        step: "review",
        analysis: {
          durationSeconds: result.durationSeconds,
          noiseLevel: result.noiseLevel,
          clarityScore: result.clarityScore,
          qualityScore,
          warnings,
        },
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Couldn't reach the local TTS engine — is it running? (cd ml-service && python -m app.main)";
      set({ step: "upload", error: message });
      toast.error(message);
    }
  },

  startTraining: async (voiceName: string) => {
    const { files } = get();
    set({ step: "training", trainingProgress: 0, error: null });

    // Zero-shot cloning is close to instant — this progress animation is purely visual
    // pacing gated on the real request below, not a simulation of actual training time.
    const tick = setInterval(() => {
      set({ trainingProgress: Math.min(90, get().trainingProgress + Math.random() * 12) });
    }, 220);

    try {
      const primary = files.reduce((a, b) => (b.size > a.size ? b : a));
      const result = await cloneVoiceRequest(voiceName, "", [primary]);
      clearInterval(tick);
      useRealVoicesStore.getState().addVoice(result);
      set({ step: "complete", trainingProgress: 100, clonedVoiceId: result.id });
    } catch (err) {
      clearInterval(tick);
      const message =
        err instanceof ApiError
          ? err.message
          : "Couldn't reach the local TTS engine — is it running? (cd ml-service && python -m app.main)";
      set({ step: "review", error: message });
      toast.error(message);
    }
  },

  reset: () =>
    set({ step: "upload", files: [], analysis: null, trainingProgress: 0, clonedVoiceId: null, error: null }),
}));
