import { Flag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils";
import { useAudioEditorStore } from "../store/audio-editor-store";

export function MarkersList() {
  const { markers, setPlayhead, removeMarker } = useAudioEditorStore();

  if (markers.length === 0) {
    return <p className="text-xs text-muted-foreground">No markers yet — press "Marker" or M while playing.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {markers
        .sort((a, b) => a.time - b.time)
        .map((marker) => (
          <div
            key={marker.id}
            className="group flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 py-1 pl-2.5 pr-1 text-xs"
          >
            <Flag className="h-3 w-3 text-warning" />
            <button onClick={() => setPlayhead(marker.time)} className="hover:underline">
              {marker.label} · {formatDuration(marker.time)}
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 opacity-0 group-hover:opacity-100"
              onClick={() => removeMarker(marker.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
    </div>
  );
}
