import { useRef } from "react";
import { useAudioEditorStore } from "../store/audio-editor-store";

const HEIGHT = 56;

export function VolumeAutomationLane() {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragId = useRef<string | null>(null);
  const { automation, duration, zoom, addAutomationPoint, moveAutomationPoint, removeAutomationPoint } =
    useAudioEditorStore();

  const width = Math.max(1, Math.round(duration * zoom));

  function coordsFromEvent(e: React.MouseEvent) {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const time = Math.max(0, Math.min(duration, (x / width) * duration));
    const value = Math.max(0, Math.min(1, 1 - y / HEIGHT));
    return { time, value };
  }

  const sorted = [...automation].sort((a, b) => a.time - b.time);
  const points = sorted.map((p) => `${(p.time / duration) * width},${(1 - p.value) * HEIGHT}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg
        ref={svgRef}
        width={width}
        height={HEIGHT}
        className="cursor-crosshair"
        onDoubleClick={(e) => {
          const { time, value } = coordsFromEvent(e);
          addAutomationPoint(time, value);
        }}
        onMouseMove={(e) => {
          if (!dragId.current) return;
          const { time, value } = coordsFromEvent(e);
          moveAutomationPoint(dragId.current, time, value);
        }}
        onMouseUp={() => (dragId.current = null)}
        onMouseLeave={() => (dragId.current = null)}
      >
        <rect width={width} height={HEIGHT} className="fill-secondary/30" />
        <polyline points={points} fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5} />
        {sorted.map((p) => (
          <circle
            key={p.id}
            cx={(p.time / duration) * width}
            cy={(1 - p.value) * HEIGHT}
            r={4}
            className="fill-primary stroke-background"
            strokeWidth={1.5}
            onMouseDown={() => (dragId.current = p.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              removeAutomationPoint(p.id);
            }}
          />
        ))}
      </svg>
    </div>
  );
}
