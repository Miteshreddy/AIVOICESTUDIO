import { create } from "zustand";
import { type ServiceType } from "~/types/services";

const GRADIENT_COLORS = [
  "linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)",
  "linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6)",
  "linear-gradient(135deg, #ec4899, #f97316, #f59e0b)",
  "linear-gradient(135deg, #10b981, #06b6d4, #6366f1)",
  "linear-gradient(135deg, #8b5cf6, #d946ef, #f43f5e)",
];

export interface Voice {
  id: string;
  name: string;
  gradientColors: string;
  service: ServiceType;
  isCloned?: boolean;
  description?: string;
  audioSample?: string;
  createdAt?: string;
}

const defaultVoices: Voice[] = [
  {
    id: "andreas",
    name: "Andreas (Deep & Clear)",
    gradientColors: GRADIENT_COLORS[0]!,
    service: "styletts2",
    description: "Versatile, natural male voice with rich resonance",
  },
  {
    id: "woman",
    name: "Sarah (Warm & Natural)",
    gradientColors: GRADIENT_COLORS[1]!,
    service: "styletts2",
    description: "Warm, friendly female narrator voice",
  },
  {
    id: "andreas",
    name: "Andreas (Voice Clone)",
    gradientColors: GRADIENT_COLORS[0]!,
    service: "seedvc",
    description: "Acoustic clone model for Andreas",
  },
  {
    id: "woman",
    name: "Sarah (Voice Clone)",
    gradientColors: GRADIENT_COLORS[1]!,
    service: "seedvc",
    description: "Acoustic clone model for Sarah",
  },
  {
    id: "trump",
    name: "Expressive Speaker",
    gradientColors: GRADIENT_COLORS[2]!,
    service: "seedvc",
    description: "Energetic, dynamic conversational voice",
  },
];

const defaultStyleTTS2Voice =
  defaultVoices.find((v) => v.service === "styletts2") ?? null;
const defaultSeedVCVoice =
  defaultVoices.find((v) => v.service === "seedvc") ?? null;

interface VoiceState {
  voices: Voice[];
  selectedVoices: Record<ServiceType, Voice | null>;
  getVoices: (service: ServiceType) => Voice[];
  getSelectedVoice: (service: ServiceType) => Voice | null;
  selectVoice: (service: ServiceType, voiceId: string) => void;
  addClonedVoice: (voice: {
    id: string;
    name: string;
    description?: string;
    audioSample?: string;
  }) => void;
  removeClonedVoice: (voiceId: string) => void;
}

const loadStoredClonedVoices = (): Voice[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("kaiz_cloned_voices");
    if (!raw) return [];
    return JSON.parse(raw) as Voice[];
  } catch {
    return [];
  }
};

const saveStoredClonedVoices = (voices: Voice[]) => {
  if (typeof window === "undefined") return;
  try {
    const cloned = voices.filter((v) => v.isCloned);
    localStorage.setItem("kaiz_cloned_voices", JSON.stringify(cloned));
  } catch (e) {
    console.error("Failed to save cloned voices:", e);
  }
};

export const useVoiceStore = create<VoiceState>((set, get) => {
  const initialCloned = loadStoredClonedVoices();
  const allInitialVoices = [...defaultVoices, ...initialCloned];

  return {
    voices: allInitialVoices,
    selectedVoices: {
      styletts2: defaultStyleTTS2Voice,
      seedvc: defaultSeedVCVoice,
      "make-an-audio": null,
    },
    getVoices: (service) => {
      return get().voices.filter((voice) => voice.service === service);
    },
    getSelectedVoice: (service) => {
      return get().selectedVoices[service];
    },
    selectVoice: (service, voiceId) => {
      const serviceVoices = get().voices.filter(
        (voice) => voice.service === service,
      );

      const selectedVoice =
        serviceVoices.find((voice) => voice.id === voiceId) ?? serviceVoices[0] ?? null;

      set((state) => ({
        selectedVoices: {
          ...state.selectedVoices,
          [service]: selectedVoice,
        },
      }));
    },
    addClonedVoice: ({ id, name, description, audioSample }) => {
      const colorIndex = (get().voices.length + 1) % GRADIENT_COLORS.length;
      const gradient = GRADIENT_COLORS[colorIndex]!;

      // Add to both TTS and Voice Changer
      const ttsCloned: Voice = {
        id,
        name: `${name} (Cloned)`,
        gradientColors: gradient,
        service: "styletts2",
        isCloned: true,
        description: description ?? "Custom cloned AI voice profile",
        audioSample,
        createdAt: new Date().toLocaleDateString(),
      };

      const vcCloned: Voice = {
        id,
        name: `${name} (Cloned)`,
        gradientColors: gradient,
        service: "seedvc",
        isCloned: true,
        description: description ?? "Custom cloned AI voice profile",
        audioSample,
        createdAt: new Date().toLocaleDateString(),
      };

      const updated = [...get().voices, ttsCloned, vcCloned];
      saveStoredClonedVoices(updated);

      set({
        voices: updated,
        selectedVoices: {
          ...get().selectedVoices,
          styletts2: ttsCloned,
        },
      });
    },
    removeClonedVoice: (voiceId) => {
      const updated = get().voices.filter((v) => v.id !== voiceId);
      saveStoredClonedVoices(updated);
      set({ voices: updated });
    },
  };
});
