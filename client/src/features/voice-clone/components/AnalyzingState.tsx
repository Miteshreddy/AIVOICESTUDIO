import { AnimatedWaveform } from "@/components/shared/AnimatedWaveform";

export function AnalyzingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <AnimatedWaveform bars={28} className="h-16" />
      <div>
        <p className="font-medium">Analyzing your voice samples…</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Checking noise levels, clarity, and language.
        </p>
      </div>
    </div>
  );
}
