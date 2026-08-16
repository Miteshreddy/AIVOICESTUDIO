import { create } from "zustand";
import type { EditorMarker, AutomationPoint, EditorSegment, EditorSnapshot } from "../types/editor";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

interface AudioEditorState {
  fileName: string | null;
  duration: number;
  peaks: number[];
  audioBuffer: AudioBuffer | null;
  zoom: number;
  playhead: number;
  isPlaying: boolean;
  selection: { start: number; end: number } | null;
  segments: EditorSegment[];
  markers: EditorMarker[];
  automation: AutomationPoint[];
  past: EditorSnapshot[];
  future: EditorSnapshot[];

  loadAudio: (fileName: string, duration: number, peaks: number[], audioBuffer: AudioBuffer) => void;
  setZoom: (zoom: number) => void;
  setPlayhead: (time: number) => void;
  setIsPlaying: (v: boolean) => void;
  setSelection: (selection: { start: number; end: number } | null) => void;

  splitAtPlayhead: () => void;
  trimToSelection: () => void;
  applyFade: (edge: "in" | "out", amount: number) => void;
  addMarker: (label: string) => void;
  removeMarker: (id: string) => void;
  addAutomationPoint: (time: number, value: number) => void;
  moveAutomationPoint: (id: string, time: number, value: number) => void;
  removeAutomationPoint: (id: string) => void;

  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
}

function snapshotOf(state: AudioEditorState): EditorSnapshot {
  return {
    segments: state.segments,
    markers: state.markers,
    automation: state.automation,
  };
}

export const useAudioEditorStore = create<AudioEditorState>((set, get) => ({
  fileName: null,
  duration: 0,
  peaks: [],
  audioBuffer: null,
  zoom: 80,
  playhead: 0,
  isPlaying: false,
  selection: null,
  segments: [],
  markers: [],
  automation: [],
  past: [],
  future: [],

  loadAudio: (fileName, duration, peaks, audioBuffer) =>
    set({
      fileName,
      duration,
      peaks,
      audioBuffer,
      segments: [{ id: uid(), start: 0, end: duration, fadeIn: 0, fadeOut: 0 }],
      markers: [],
      automation: [
        { id: uid(), time: 0, value: 1 },
        { id: uid(), time: duration, value: 1 },
      ],
      playhead: 0,
      selection: null,
      past: [],
      future: [],
    }),

  setZoom: (zoom) => set({ zoom: Math.max(20, Math.min(400, zoom)) }),
  setPlayhead: (time) => set({ playhead: Math.max(0, Math.min(get().duration, time)) }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  setSelection: (selection) => set({ selection }),

  pushHistory: () => set({ past: [...get().past, snapshotOf(get())], future: [] }),

  splitAtPlayhead: () => {
    const { playhead, segments } = get();
    const target = segments.find((s) => playhead > s.start && playhead < s.end);
    if (!target) return;
    get().pushHistory();
    const left: EditorSegment = { ...target, id: uid(), end: playhead, fadeOut: 0 };
    const right: EditorSegment = { ...target, id: uid(), start: playhead, fadeIn: 0 };
    set({
      segments: segments.flatMap((s) => (s.id === target.id ? [left, right] : [s])),
    });
  },

  trimToSelection: () => {
    const { selection, segments } = get();
    if (!selection) return;
    get().pushHistory();
    set({
      segments: segments
        .map((s) => ({
          ...s,
          start: Math.max(s.start, selection.start),
          end: Math.min(s.end, selection.end),
        }))
        .filter((s) => s.end > s.start),
      selection: null,
    });
  },

  applyFade: (edge, amount) => {
    const { selection, playhead, segments } = get();
    const time = selection?.start ?? playhead;
    const target = segments.find((s) => time >= s.start && time <= s.end) ?? segments[0];
    if (!target) return;
    get().pushHistory();
    set({
      segments: segments.map((s) =>
        s.id === target.id ? { ...s, [edge === "in" ? "fadeIn" : "fadeOut"]: amount } : s,
      ),
    });
  },

  addMarker: (label) => {
    get().pushHistory();
    set({ markers: [...get().markers, { id: uid(), time: get().playhead, label }] });
  },
  removeMarker: (id) => {
    get().pushHistory();
    set({ markers: get().markers.filter((m) => m.id !== id) });
  },

  addAutomationPoint: (time, value) => {
    get().pushHistory();
    set({ automation: [...get().automation, { id: uid(), time, value }].sort((a, b) => a.time - b.time) });
  },
  moveAutomationPoint: (id, time, value) => {
    set({
      automation: get()
        .automation.map((p) => (p.id === id ? { ...p, time, value } : p))
        .sort((a, b) => a.time - b.time),
    });
  },
  removeAutomationPoint: (id) => {
    get().pushHistory();
    set({ automation: get().automation.filter((p) => p.id !== id) });
  },

  undo: () => {
    const { past } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    set({
      ...previous,
      past: past.slice(0, -1),
      future: [snapshotOf(get()), ...get().future],
    });
  },
  redo: () => {
    const { future } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      ...next,
      future: future.slice(1),
      past: [...get().past, snapshotOf(get())],
    });
  },
}));
