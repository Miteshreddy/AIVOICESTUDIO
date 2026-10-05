import { create } from "zustand";
import { useAudioPlayerStore } from "./audio-player-store";

export interface NowPlaying {
  /** Unique playback id (shared with the audio player store). */
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  /** Seed for the orb (usually the voice id). */
  orbSeed: string;
  downloadName: string;
}

interface NowPlayingState {
  current: NowPlaying | null;
  /** Load a track into the player bar and start playing it. */
  open: (track: NowPlaying, autoplay?: boolean) => void;
  close: () => void;
}

export const useNowPlayingStore = create<NowPlayingState>((set) => ({
  current: null,
  open: (track, autoplay = true) => {
    set({ current: track });
    if (autoplay) void useAudioPlayerStore.getState().play(track.id, track.url);
  },
  close: () => {
    useAudioPlayerStore.getState().stop();
    set({ current: null });
  },
}));
