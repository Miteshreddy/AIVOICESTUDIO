import { create } from "zustand";
import {
  deleteClonedVoice,
  listClonedVoices,
  updateClonedVoice,
  type RemoteVoiceSummary,
  type VoiceUpdateFields,
} from "@/services/tts-service";

interface RealVoicesState {
  voices: RemoteVoiceSummary[];
  loaded: boolean;
  refresh: () => Promise<void>;
  addVoice: (voice: RemoteVoiceSummary) => void;
  removeVoice: (id: string) => Promise<void>;
  updateVoice: (id: string, fields: VoiceUpdateFields) => Promise<void>;
}

export const useRealVoicesStore = create<RealVoicesState>((set, get) => ({
  voices: [],
  loaded: false,

  refresh: async () => {
    try {
      const voices = await listClonedVoices();
      set({ voices, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  addVoice: (voice) => set({ voices: [voice, ...get().voices] }),

  removeVoice: async (id) => {
    const previous = get().voices;
    set({ voices: previous.filter((v) => v.id !== id) });
    try {
      await deleteClonedVoice(id);
    } catch {
      set({ voices: previous });
      throw new Error("Couldn't delete voice — is the local TTS engine running?");
    }
  },

  updateVoice: async (id, fields) => {
    const previous = get().voices;
    set({ voices: previous.map((v) => (v.id === id ? { ...v, ...fields } : v)) });
    try {
      const updated = await updateClonedVoice(id, fields);
      set({ voices: get().voices.map((v) => (v.id === id ? updated : v)) });
    } catch {
      set({ voices: previous });
      throw new Error("Couldn't update voice — is the local TTS engine running?");
    }
  },
}));
