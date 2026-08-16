import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import type { CleanupOperation } from "../store/audio-cleanup-store";

interface OperationRowProps {
  label: string;
  description: string;
  operation: CleanupOperation;
  onToggle: () => void;
  onAmountChange: (v: number) => void;
}

export function OperationRow({ label, description, operation, onToggle, onAmountChange }: OperationRowProps) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">{label}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch checked={operation.enabled} onCheckedChange={onToggle} />
      </div>
      {operation.enabled && (
        <div className="flex items-center gap-3">
          <Slider
            value={[operation.amount]}
            onValueChange={([v]) => onAmountChange(v)}
            min={0}
            max={100}
            step={1}
          />
          <span className="w-9 shrink-0 text-right font-mono text-xs text-muted-foreground">
            {operation.amount}
          </span>
        </div>
      )}
    </div>
  );
}
