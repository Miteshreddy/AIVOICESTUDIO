import { create } from "zustand";
import type { VoiceAttributes } from "@/types/voice";
import { defaultVoiceAttributes } from "@/types/voice";
import type { VoicePreset } from "../data/presets";

interface VoiceStudioState {
  text: string;
  attributes: VoiceAttributes;
  activePresetId: string | null;
  voiceName: string;
  isGenerating: boolean;
  previewAudioUrl: string | null;
  setText: (text: string) => void;
  setPreviewAudioUrl: (url: string | null) => void;
  setAttribute: (key: keyof VoiceAttributes, value: number) => void;
  applyPreset: (preset: VoicePreset) => void;
  setVoiceName: (name: string) => void;
  resetAttributes: () => void;
  setGenerating: (v: boolean) => void;
}

export const useVoiceStudioStore = create<VoiceStudioState>((set, get) => ({
  text: "",
  attributes: { ...defaultVoiceAttributes },
  activePresetId: null,
  voiceName: "Untitled Voice",
  isGenerating: false,
  previewAudioUrl: null,
  setText: (text) => set({ text }),
  setPreviewAudioUrl: (url) => set({ previewAudioUrl: url }),
  setAttribute: (key, value) =>
    set({ attributes: { ...get().attributes, [key]: value }, activePresetId: null }),
  applyPreset: (preset) =>
    set({
      attributes: { ...get().attributes, ...preset.attributes },
      activePresetId: preset.id,
    }),
  setVoiceName: (name) => set({ voiceName: name }),
  resetAttributes: () => set({ attributes: { ...defaultVoiceAttributes }, activePresetId: null }),
  setGenerating: (v) => set({ isGenerating: v }),
}));
