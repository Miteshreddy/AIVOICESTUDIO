import { Check, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const steps = ["Preprocessing audio", "Extracting voice features", "Training model", "Finalizing"];

export function TrainingProgress({ progress }: { progress: number }) {
  const activeStepIndex = Math.min(steps.length - 1, Math.floor((progress / 100) * steps.length));

  return (
    <div className="mx-auto max-w-md space-y-8 py-16 text-center">
      <div>
        <p className="text-3xl font-semibold tracking-tight">{progress}%</p>
        <p className="mt-1 text-sm text-muted-foreground">Training your voice model…</p>
      </div>
      <Progress value={progress} />
      <ul className="space-y-3 text-left">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center gap-3 text-sm">
            {i < activeStepIndex ? (
              <Check className="h-4 w-4 text-success" />
            ) : i === activeStepIndex ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <div className="h-4 w-4 rounded-full border border-border" />
            )}
            <span className={cn(i > activeStepIndex && "text-muted-foreground")}>{step}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
