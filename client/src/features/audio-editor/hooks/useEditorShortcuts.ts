import { useEffect } from "react";
import { useAudioEditorStore } from "../store/audio-editor-store";

export function useEditorShortcuts(onTogglePlay: () => void) {
  const { splitAtPlayhead, trimToSelection, selection, undo, redo } = useAudioEditorStore();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA"].includes(target.tagName)) return;

      if (e.code === "Space") {
        e.preventDefault();
        onTogglePlay();
      } else if (e.key.toLowerCase() === "s" && !e.metaKey && !e.ctrlKey) {
        splitAtPlayhead();
      } else if (e.key.toLowerCase() === "t" && selection) {
        trimToSelection();
      } else if (e.key.toLowerCase() === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key.toLowerCase() === "z" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        redo();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onTogglePlay, splitAtPlayhead, trimToSelection, selection, undo, redo]);
}
