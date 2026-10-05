import { Download, Pause, Play, RotateCcw, X } from "lucide-react";
import { useAudioPlayerStore } from "@/store/audio-player-store";
import { useNowPlayingStore } from "@/store/now-playing-store";
import { VoiceOrb } from "./VoiceOrb";
import { Waveform } from "./Waveform";

function fmt(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Global player docked at the bottom of every page. */
export function PlayerBar() {
  const current = useNowPlayingStore((s) => s.current);
  const close = useNowPlayingStore((s) => s.close);
  const { playingId, isPaused, currentTime, duration, toggle, seek } = useAudioPlayerStore();

  if (!current) return null;

  const isThis = playingId === current.id;
  const playing = isThis && !isPaused;
  const progress = isThis && duration > 0 ? currentTime / duration : 0;

  return (
    <div className="animate-rise-in border-t border-border/70 bg-card/80 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        <button
          type="button"
          onClick={() => toggle(current.id, current.url)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-foreground text-background transition hover:scale-105 active:scale-95"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>

        <div className="hidden min-w-0 items-center gap-3 sm:flex sm:w-56">
          <VoiceOrb seed={current.orbSeed} size={32} active={playing} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{current.title}</p>
            {current.subtitle && <p className="truncate text-xs text-muted-foreground">{current.subtitle}</p>}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="w-9 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
            {fmt(isThis ? currentTime : 0)}
          </span>
          <Waveform
            url={current.url}
            progress={progress}
            onSeek={(f) => {
              if (!isThis) void toggle(current.id, current.url);
              seek(f * (duration || 0));
            }}
          />
          <span className="w-9 font-mono text-[11px] tabular-nums text-muted-foreground">{fmt(duration)}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => seek(0)}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Restart"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <a
            href={current.url}
            download={current.downloadName}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Download"
          >
            <Download className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={close}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Close player"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
