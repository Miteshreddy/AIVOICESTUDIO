import { useEffect, useRef, useState } from "react";
import { useAudioEditorStore } from "../store/audio-editor-store";

const HEIGHT = 140;

export function WaveformCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const {
    peaks,
    duration,
    zoom,
    playhead,
    selection,
    segments,
    markers,
    setPlayhead,
    setSelection,
  } = useAudioEditorStore();

  const width = Math.max(1, Math.round(duration * zoom));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${HEIGHT}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, HEIGHT);

    const styles = getComputedStyle(document.documentElement);
    const isDark = document.documentElement.classList.contains("dark");
    const from = `hsl(${styles.getPropertyValue("--waveform-from").trim()})`;
    const to = `hsl(${styles.getPropertyValue("--waveform-to").trim()})`;

    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, from);
    gradient.addColorStop(1, to);

    // segment boundaries + fades (drawn first, as background bands)
    for (const seg of segments) {
      const x1 = (seg.start / duration) * width;
      const x2 = (seg.end / duration) * width;
      if (seg.fadeIn > 0) {
        const fadeWidth = Math.min(x2 - x1, (seg.fadeIn / duration) * width);
        const fadeGrad = ctx.createLinearGradient(x1, 0, x1 + fadeWidth, 0);
        fadeGrad.addColorStop(0, isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)");
        fadeGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = fadeGrad;
        ctx.fillRect(x1, 0, fadeWidth, HEIGHT);
      }
      if (seg.fadeOut > 0) {
        const fadeWidth = Math.min(x2 - x1, (seg.fadeOut / duration) * width);
        const fadeGrad = ctx.createLinearGradient(x2 - fadeWidth, 0, x2, 0);
        fadeGrad.addColorStop(0, "rgba(0,0,0,0)");
        fadeGrad.addColorStop(1, isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)");
        ctx.fillStyle = fadeGrad;
        ctx.fillRect(x2 - fadeWidth, 0, fadeWidth, HEIGHT);
      }
    }

    // waveform bars
    ctx.fillStyle = gradient;
    const mid = HEIGHT / 2;
    const barWidth = Math.max(1, width / peaks.length);
    peaks.forEach((peak, i) => {
      const x = i * barWidth;
      const barHeight = Math.max(1.5, peak * (HEIGHT / 2 - 8));
      ctx.fillRect(x, mid - barHeight, Math.max(1, barWidth - 1), barHeight * 2);
    });

    // segment split lines
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)";
    ctx.lineWidth = 1;
    for (const seg of segments) {
      const x = (seg.start / duration) * width;
      if (x > 0) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
        ctx.stroke();
      }
    }

    // selection
    if (selection) {
      const x1 = (selection.start / duration) * width;
      const x2 = (selection.end / duration) * width;
      ctx.fillStyle = "rgba(124, 58, 237, 0.18)";
      ctx.fillRect(x1, 0, x2 - x1, HEIGHT);
      ctx.strokeStyle = "rgba(124, 58, 237, 0.6)";
      ctx.strokeRect(x1, 0, x2 - x1, HEIGHT);
    }

    // playhead
    const playX = (playhead / duration) * width;
    ctx.strokeStyle = "hsl(var(--primary))";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playX, 0);
    ctx.lineTo(playX, HEIGHT);
    ctx.stroke();

    // markers
    ctx.fillStyle = "hsl(var(--warning))";
    for (const marker of markers) {
      const x = (marker.time / duration) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 6, 6);
      ctx.lineTo(x, 12);
      ctx.closePath();
      ctx.fill();
    }
  }, [peaks, duration, zoom, playhead, selection, segments, markers, width]);

  function timeFromEvent(e: React.MouseEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    return Math.max(0, Math.min(duration, (x / width) * duration));
  }

  return (
    <div ref={containerRef} className="overflow-x-auto">
      <canvas
        ref={canvasRef}
        className="cursor-pointer"
        onMouseDown={(e) => {
          dragStart.current = timeFromEvent(e);
          setSelection(null);
        }}
        onMouseMove={(e) => {
          const t = timeFromEvent(e);
          setHoverTime(t);
          if (dragStart.current !== null) {
            setSelection({
              start: Math.min(dragStart.current, t),
              end: Math.max(dragStart.current, t),
            });
          }
        }}
        onMouseUp={(e) => {
          const t = timeFromEvent(e);
          if (dragStart.current !== null && Math.abs(t - dragStart.current) < 0.05) {
            setPlayhead(t);
            setSelection(null);
          }
          dragStart.current = null;
        }}
        onMouseLeave={() => setHoverTime(null)}
      />
      {hoverTime !== null && (
        <div className="pointer-events-none mt-1 text-[10px] text-muted-foreground">
          {hoverTime.toFixed(2)}s
        </div>
      )}
    </div>
  );
}
