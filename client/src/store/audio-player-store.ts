import { create } from "zustand";

// A single shared <audio> element for the whole app. Every playback surface
// (voice library cards, the voice picker, generation results) routes through
// this store instead of owning its own <audio> — that's what guarantees only
// one thing is ever audible at once, with one shared transport (play/pause,
// seek, skip) instead of each surface reinventing its own.
const sharedAudio = typeof Audio !== "undefined" ? new Audio() : null;

interface AudioPlayerState {
  playingId: string | null;
  loadingId: string | null;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  play: (id: string, url: string) => Promise<void>;
  toggle: (id: string, url: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  seek: (time: number) => void;
  skip: (deltaSeconds: number) => void;
  stop: () => void;
}

export const useAudioPlayerStore = create<AudioPlayerState>((set, get) => {
  if (sharedAudio) {
    sharedAudio.addEventListener("timeupdate", () => {
      set({ currentTime: sharedAudio.currentTime });
    });
    sharedAudio.addEventListener("loadedmetadata", () => {
      set({ duration: sharedAudio.duration });
    });
    sharedAudio.addEventListener("ended", () => {
      set({ playingId: null, isPaused: false, currentTime: 0 });
    });
    sharedAudio.addEventListener("pause", () => {
      if (!sharedAudio.ended) set({ isPaused: true });
    });
    sharedAudio.addEventListener("play", () => {
      set({ isPaused: false });
    });
  }

  return {
    playingId: null,
    loadingId: null,
    isPaused: false,
    currentTime: 0,
    duration: 0,

    play: async (id, url) => {
      if (!sharedAudio) return;
      const isSameTrack = get().playingId === id;
      set({ loadingId: id });
      try {
        if (!isSameTrack) {
          sharedAudio.src = url;
          set({ playingId: id, currentTime: 0, duration: 0 });
        }
        await sharedAudio.play();
      } finally {
        set({ loadingId: null });
      }
    },

    toggle: async (id, url) => {
      const { playingId, isPaused, play, pause, resume } = get();
      if (playingId === id) {
        if (isPaused) resume();
        else pause();
        return;
      }
      await play(id, url);
    },

    pause: () => {
      sharedAudio?.pause();
    },

    resume: () => {
      sharedAudio?.play();
    },

    seek: (time) => {
      if (!sharedAudio) return;
      sharedAudio.currentTime = time;
      set({ currentTime: time });
    },

    skip: (deltaSeconds) => {
      if (!sharedAudio) return;
      const next = Math.min(Math.max(sharedAudio.currentTime + deltaSeconds, 0), sharedAudio.duration || Infinity);
      sharedAudio.currentTime = next;
      set({ currentTime: next });
    },

    stop: () => {
      if (!sharedAudio) return;
      sharedAudio.pause();
      sharedAudio.currentTime = 0;
      set({ playingId: null, isPaused: false, currentTime: 0 });
    },
  };
});
