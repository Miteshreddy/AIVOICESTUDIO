import { create } from "zustand";
import {
  deleteGeneration,
  downloadGenerationAudio,
  generateSpeechAudio,
  listGenerations,
  updateGeneration,
  type GenerationRecord,
} from "@/services/tts-service";

const audioUrlCache = new Map<string, string>();

interface GenerationsState {
  generations: GenerationRecord[];
  loaded: boolean;
  refresh: () => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  archive: (id: string) => Promise<void>;
  unarchive: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  duplicate: (id: string) => Promise<void>;
  getAudioUrl: (id: string) => Promise<string>;
  seedAudioUrl: (id: string, url: string) => void;
}

export const useGenerationsStore = create<GenerationsState>((set, get) => ({
  generations: [],
  loaded: false,

  refresh: async () => {
    try {
      const generations = await listGenerations();
      set({ generations, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  toggleFavorite: async (id) => {
    const target = get().generations.find((g) => g.id === id);
    if (!target) return;
    const previous = get().generations;
    set({
      generations: previous.map((g) => (g.id === id ? { ...g, favorite: !g.favorite } : g)),
    });
    try {
      await updateGeneration(id, { favorite: !target.favorite });
    } catch {
      set({ generations: previous });
    }
  },

  archive: async (id) => {
    const previous = get().generations;
    set({ generations: previous.map((g) => (g.id === id ? { ...g, status: "archived" } : g)) });
    try {
      await updateGeneration(id, { status: "archived" });
    } catch {
      set({ generations: previous });
    }
  },

  unarchive: async (id) => {
    const previous = get().generations;
    set({ generations: previous.map((g) => (g.id === id ? { ...g, status: "ready" } : g)) });
    try {
      await updateGeneration(id, { status: "ready" });
    } catch {
      set({ generations: previous });
    }
  },

  remove: async (id) => {
    const previous = get().generations;
    set({ generations: previous.filter((g) => g.id !== id) });
    try {
      await deleteGeneration(id);
    } catch {
      set({ generations: previous });
    }
  },

  duplicate: async (id) => {
    const target = get().generations.find((g) => g.id === id);
    if (!target) return;
    await generateSpeechAudio({ voiceId: target.voiceId ?? undefined, text: target.text });
    await get().refresh();
  },

  getAudioUrl: async (id) => {
    const cached = audioUrlCache.get(id);
    if (cached) return cached;
    const url = await downloadGenerationAudio(id);
    audioUrlCache.set(id, url);
    return url;
  },

  seedAudioUrl: (id, url) => {
    if (!audioUrlCache.has(id)) audioUrlCache.set(id, url);
  },
}));
