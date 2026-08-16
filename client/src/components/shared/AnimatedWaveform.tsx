import { cn } from "@/lib/utils";

interface AnimatedWaveformProps {
  bars?: number;
  className?: string;
  barClassName?: string;
}

const DELAYS = [0, 0.1, 0.2, 0.3, 0.15, 0.25, 0.05, 0.35, 0.2, 0.1, 0.3, 0];

export function AnimatedWaveform({ bars = 12, className, barClassName }: AnimatedWaveformProps) {
  return (
    <div className={cn("flex h-8 items-center gap-[3px]", className)}>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "w-1 animate-waveform-bounce rounded-full bg-gradient-brand",
            barClassName,
          )}
          style={{
            height: "100%",
            animationDelay: `${DELAYS[i % DELAYS.length]}s`,
            animationDuration: `${0.9 + (i % 5) * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}
