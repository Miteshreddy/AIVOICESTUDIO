import { useEffect, useState } from "react";
import { Download, Star, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AudioPlayerBar } from "@/components/shared/AudioPlayerBar";
import { formatDuration, formatRelativeTime, cn } from "@/lib/utils";
import { useAudioPlayerStore } from "@/store/audio-player-store";
import { useGenerationsStore } from "@/store/generations-store";
import type { GenerationRecord } from "@/services/tts-service";

const NAMESPACE = "generation:";

export function GenerationResult({ generation }: { generation: GenerationRecord }) {
  const { playingId, duration } = useAudioPlayerStore();
  const { getAudioUrl, toggleFavorite, remove } = useGenerationsStore();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAudioUrl(generation.id).then((url) => {
      if (!cancelled) setAudioUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [generation.id, getAudioUrl]);

  const playerId = NAMESPACE + generation.id;
  const isActive = playingId === playerId;
  const actualDuration = isActive && duration > 0 ? duration : null;

  function handleDownload() {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `${generation.voiceName.replace(/\s+/g, "-").toLowerCase()}-${generation.id}.wav`;
    a.click();
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{generation.text}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {generation.voiceName} ·{" "}
            {actualDuration !== null
              ? formatDuration(actualDuration)
              : `~${formatDuration(generation.durationSeconds)}`}{" "}
            · {formatRelativeTime(generation.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => toggleFavorite(generation.id)}>
            <Star className={cn("h-4 w-4", generation.favorite && "fill-warning text-warning")} />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleDownload} disabled={!audioUrl}>
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => remove(generation.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {audioUrl ? (
        <AudioPlayerBar id={playerId} url={audioUrl} />
      ) : (
        <div className="flex h-10 items-center justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}
    </div>
  );
}
