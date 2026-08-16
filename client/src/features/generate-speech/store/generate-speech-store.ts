import { create } from "zustand";
import { toast } from "sonner";
import { generateSpeechAudio } from "@/services/tts-service";
import { ApiError } from "@/services/api-client";
import { useGenerationsStore } from "@/store/generations-store";

interface GenerateSpeechState {
  selectedVoiceId: string | null;
  selectedVoiceName: string;
  text: string;
  isGenerating: boolean;
  generationStartedAt: number | null;
  // 0-100 UI scale — converted to Chatterbox's 0-1 params on generate.
  expressiveness: number;
  stability: number;
  creativity: number;
  setSelectedVoice: (id: string | null, name: string) => void;
  setText: (text: string) => void;
  setExpressiveness: (v: number) => void;
  setStability: (v: number) => void;
  setCreativity: (v: number) => void;
  generate: () => Promise<void>;
}

export const useGenerateSpeechStore = create<GenerateSpeechState>((set, get) => ({
  selectedVoiceId: null,
  selectedVoiceName: "Default voice",
  text: "",
  isGenerating: false,
  generationStartedAt: null,
  expressiveness: 45,
  stability: 60,
  creativity: 60,

  setSelectedVoice: (id, name) => set({ selectedVoiceId: id, selectedVoiceName: name }),
  setText: (text) => set({ text }),
  setExpressiveness: (v) => set({ expressiveness: v }),
  setStability: (v) => set({ stability: v }),
  setCreativity: (v) => set({ creativity: v }),

  generate: async () => {
    const { text, selectedVoiceId, expressiveness, stability, creativity, isGenerating } = get();
    if (!text.trim() || isGenerating) return;
    set({ isGenerating: true, generationStartedAt: Date.now() });

    try {
      const audioUrl = await generateSpeechAudio({
        text,
        voiceId: selectedVoiceId ?? undefined,
        exaggeration: expressiveness / 100,
        cfgWeight: stability / 100,
        temperature: creativity / 100,
      });

      // The /tts call already persisted this generation server-side — pull the
      // fresh history and seed the blob URL we already have onto the newest
      // record, so it plays instantly instead of re-fetching the same audio.
      const generationsStore = useGenerationsStore.getState();
      await generationsStore.refresh();
      const latest = useGenerationsStore.getState().generations[0];
      if (latest) generationsStore.seedAudioUrl(latest.id, audioUrl);

      set({ isGenerating: false, generationStartedAt: null });
    } catch (err) {
      set({ isGenerating: false, generationStartedAt: null });
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Couldn't reach the local TTS engine — is it running? (cd ml-service && python -m app.main)",
      );
    }
  },
}));
