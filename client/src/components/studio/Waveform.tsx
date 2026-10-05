import { useEffect, useRef, useState } from "react";

const peakCache = new Map<string, number[]>();

async function computePeaks(url: string, buckets: number): Promise<number[]> {
  const cached = peakCache.get(url);
  if (cached) return cached;
  const data = await (await fetch(url)).arrayBuffer();
  const ctx = new AudioContext();
  try {
    const buffer = await ctx.decodeAudioData(data);
    const channel = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(channel.length / buckets));
    const peaks: number[] = [];
    for (let i = 0; i < buckets; i++) {
      let sum = 0;
      for (let j = i * step; j < (i + 1) * step && j < channel.length; j++) sum += channel[j] * channel[j];
      peaks.push(Math.sqrt(sum / step));
    }
    const max = Math.max(...peaks, 1e-6);
    const normalised = peaks.map((p) => Math.max(0.04, Math.pow(p / max, 0.7)));
    peakCache.set(url, normalised);
    return normalised;
  } finally {
    void ctx.close();
  }
}

/** Real waveform of the audio, with progress fill and click-to-seek. */
export function Waveform({
  url,
  progress,
  onSeek,
  bars = 120,
  height = 36,
}: {
  url: string;
  progress: number; // 0..1
  onSeek?: (fraction: number) => void;
  bars?: number;
  height?: number;
}) {
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setPeaks(null);
    computePeaks(url, bars)
      .then((p) => alive && setPeaks(p))
      .catch(() => alive && setPeaks(Array.from({ length: bars }, () => 0.2)));
    return () => {
      alive = false;
    };
  }, [url, bars]);

  return (
    <div
      ref={ref}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      tabIndex={0}
      className="flex w-full cursor-pointer items-center gap-[2px]"
      style={{ height }}
      onClick={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (rect && onSeek) onSeek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
      }}
      onKeyDown={(e) => {
        if (!onSeek) return;
        if (e.key === "ArrowRight") onSeek(Math.min(1, progress + 0.05));
        if (e.key === "ArrowLeft") onSeek(Math.max(0, progress - 0.05));
      }}
    >
      {(peaks ?? Array.from({ length: bars }, () => 0.12)).map((p, i) => {
        const played = i / bars < progress;
        return (
          <span
            key={i}
            className="flex-1 rounded-full transition-colors"
            style={{
              height: `${Math.round(p * 100)}%`,
              background: played ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.35)",
              opacity: peaks ? 1 : 0.5,
            }}
          />
        );
      })}
    </div>
  );
}
