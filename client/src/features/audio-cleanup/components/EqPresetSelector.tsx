import { cn } from "@/lib/utils";
import { eqPresets } from "../data/eq-presets";

export function EqPresetSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {eqPresets.map((preset) => (
        <button
          key={preset.id}
          onClick={() => onChange(preset.id)}
          className={cn(
            "focus-ring rounded-lg border border-border px-3 py-2.5 text-left text-xs transition-colors hover:bg-secondary",
            value === preset.id && "border-primary/40 bg-primary/10",
          )}
        >
          <p className="font-medium">{preset.label}</p>
          <p className="mt-0.5 line-clamp-1 text-muted-foreground">{preset.description}</p>
        </button>
      ))}
    </div>
  );
}
