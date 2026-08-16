import { useState } from "react";
import {
  Play,
  Pause,
  Scissors,
  Crop,
  Undo2,
  Redo2,
  Flag,
  ZoomIn,
  ZoomOut,
  TrendingDown,
  TrendingUp,
  Download,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAudioEditorStore } from "../store/audio-editor-store";
import { formatDuration } from "@/lib/utils";
import { renderEditedAudio } from "../lib/render-export";

export function EditorToolbar({ onTogglePlay }: { onTogglePlay: () => void }) {
  const {
    isPlaying,
    playhead,
    duration,
    zoom,
    selection,
    past,
    future,
    segments,
    automation,
    audioBuffer,
    fileName,
    setZoom,
    splitAtPlayhead,
    trimToSelection,
    applyFade,
    addMarker,
    undo,
    redo,
  } = useAudioEditorStore();

  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!audioBuffer) return;
    setExporting(true);
    try {
      const blob = await renderEditedAudio(audioBuffer, segments, automation);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(fileName ?? "edit").replace(/\.[^.]+$/, "")}-edited.wav`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success("Exported edited audio.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onTogglePlay}>
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <span className="w-24 font-mono text-xs tabular-nums text-muted-foreground">
        {formatDuration(playhead)} / {formatDuration(duration)}
      </span>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={splitAtPlayhead}>
        <Scissors className="h-3.5 w-3.5" /> Split
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs"
        onClick={trimToSelection}
        disabled={!selection}
      >
        <Crop className="h-3.5 w-3.5" /> Trim
      </Button>
      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => applyFade("in", 1)}>
        <TrendingUp className="h-3.5 w-3.5" /> Fade In
      </Button>
      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => applyFade("out", 1)}>
        <TrendingDown className="h-3.5 w-3.5" /> Fade Out
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs"
        onClick={() => addMarker(`Marker ${formatDuration(playhead)}`)}
      >
        <Flag className="h-3.5 w-3.5" /> Marker
      </Button>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo} disabled={past.length === 0}>
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo} disabled={future.length === 0}>
        <Redo2 className="h-4 w-4" />
      </Button>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="brand"
          size="sm"
          className="h-8 px-3 text-xs"
          onClick={handleExport}
          disabled={exporting || !audioBuffer}
        >
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Export
        </Button>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(zoom - 20)}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(zoom + 20)}>
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
