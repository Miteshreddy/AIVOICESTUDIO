import { Play, Pause, RotateCcw, RotateCw, Loader2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useAudioPlayerStore } from "@/store/audio-player-store";
import { cn } from "@/lib/utils";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayerBar({
  id,
  url,
  className,
}: {
  id: string;
  url: string;
  className?: string;
}) {
  const { playingId, loadingId, isPaused, currentTime, duration, toggle, seek, skip } = useAudioPlayerStore();

  const isActive = playingId === id;
  const isLoading = loadingId === id;
  const isPlaying = isActive && !isPaused;
  const time = isActive ? currentTime : 0;
  const total = isActive ? duration : 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={() => skip(-10)}
        disabled={!isActive}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
        title="Back 10s"
      >
        <RotateCcw className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => toggle(id, url)}
        disabled={isLoading}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105"
        title={isPlaying ? "Pause" : "Play"}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="ml-0.5 h-4 w-4 fill-current" />
        )}
      </button>

      <button
        type="button"
        onClick={() => skip(10)}
        disabled={!isActive}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
        title="Forward 10s"
      >
        <RotateCw className="h-4 w-4" />
      </button>

      <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
        {formatTime(time)}
      </span>
      <Slider
        value={[time]}
        max={total || 1}
        step={0.1}
        onValueChange={([v]) => {
          if (isActive) seek(v);
        }}
        className="flex-1"
      />
      <span className="w-9 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
        {formatTime(total)}
      </span>
    </div>
  );
}
