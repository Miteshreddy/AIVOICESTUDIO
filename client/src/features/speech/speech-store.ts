import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SpeechSettings {
  stability: number; // 0-100
  speed: number; // 70-130 (%)
}

export const DEFAULT_SETTINGS: SpeechSettings = { stability: 50, speed: 100 };

interface SpeechState extends SpeechSettings {
  /** Takes generated per passage; the engine keeps the best. */
  takes: 1 | 2;
  setTakes: (takes: 1 | 2) => void;
  text: string;
  voiceId: string | null;
  voiceName: string;
  setText: (text: string) => void;
  setVoice: (id: string, name: string) => void;
  setSetting: (key: keyof SpeechSettings, value: number) => void;
  resetSettings: () => void;
}

export const useSpeechStore = create<SpeechState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      takes: 2,
      setTakes: (takes) => set({ takes }),
      text: "",
      voiceId: null,
      voiceName: "",
      setText: (text) => set({ text }),
      setVoice: (voiceId, voiceName) => set({ voiceId, voiceName }),
      setSetting: (key, value) => set({ [key]: value } as Pick<SpeechSettings, typeof key>),
      resetSettings: () => set(DEFAULT_SETTINGS),
    }),
    { name: "kaiz-speech", version: 2, migrate: (state) => ({ ...(state as object), ...DEFAULT_SETTINGS }) as SpeechState },
  ),
);
