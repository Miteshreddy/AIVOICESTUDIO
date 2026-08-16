import { create } from "zustand";
import { toast } from "sonner";
import { processAudio } from "@/services/audio-processing-service";
import { ApiError } from "@/services/api-client";

export interface CleanupOperation {
  enabled: boolean;
  amount: number;
}

interface AudioCleanupState {
  file: File | null;
  status: "idle" | "processing" | "done";
  resultUrl: string | null;
  noiseRemoval: CleanupOperation;
  echoRemoval: CleanupOperation;
  normalize: CleanupOperation;
  silenceRemoval: CleanupOperation;
  volumeLeveling: CleanupOperation;
  aiEnhancement: CleanupOperation;
  compressor: CleanupOperation;
  limiter: CleanupOperation;
  eqPreset: string;
  setFile: (file: File | null) => void;
  toggleOperation: (key: OperationKey) => void;
  setAmount: (key: OperationKey, amount: number) => void;
  setEqPreset: (id: string) => void;
  process: () => Promise<void>;
  reset: () => void;
}

export type OperationKey =
  | "noiseRemoval"
  | "echoRemoval"
  | "normalize"
  | "silenceRemoval"
  | "volumeLeveling"
  | "aiEnhancement"
  | "compressor"
  | "limiter";

const defaultOp: CleanupOperation = { enabled: true, amount: 60 };

export const useAudioCleanupStore = create<AudioCleanupState>((set, get) => ({
  file: null,
  status: "idle",
  resultUrl: null,
  noiseRemoval: { ...defaultOp, amount: 70 },
  echoRemoval: { ...defaultOp, enabled: false, amount: 50 },
  normalize: { ...defaultOp, amount: 100 },
  silenceRemoval: { ...defaultOp, enabled: false, amount: 40 },
  volumeLeveling: { ...defaultOp, amount: 65 },
  aiEnhancement: { ...defaultOp, enabled: false, amount: 75 },
  compressor: { ...defaultOp, enabled: false, amount: 50 },
  limiter: { ...defaultOp, enabled: false, amount: 85 },
  eqPreset: "podcast",

  setFile: (file) => set({ file, status: "idle", resultUrl: null }),
  toggleOperation: (key) =>
    set({ [key]: { ...get()[key], enabled: !get()[key].enabled } } as Partial<AudioCleanupState>),
  setAmount: (key, amount) =>
    set({ [key]: { ...get()[key], amount } } as Partial<AudioCleanupState>),
  setEqPreset: (id) => set({ eqPreset: id }),

  process: async () => {
    const { file } = get();
    if (!file) return;
    set({ status: "processing" });

    try {
      const {
        noiseRemoval,
        echoRemoval,
        normalize,
        silenceRemoval,
        volumeLeveling,
        aiEnhancement,
        compressor,
        limiter,
        eqPreset,
      } = get();
      const resultUrl = await processAudio(file, {
        noiseRemoval,
        echoRemoval,
        normalize,
        silenceRemoval,
        volumeLeveling,
        aiEnhancement,
        compressor,
        limiter,
        eqPreset,
      });
      set({ status: "done", resultUrl });
    } catch (err) {
      set({ status: "idle" });
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Couldn't reach the local engine — is it running? (cd ml-service && python -m app.main)",
      );
    }
  },

  reset: () =>
    set({
      file: null,
      status: "idle",
      resultUrl: null,
    }),
}));
