import { Info } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SliderConfig } from "../data/slider-config";

interface VoiceSliderProps {
  config: SliderConfig;
  value: number;
  onChange: (value: number) => void;
}

export function VoiceSlider({ config, value, onChange }: VoiceSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs font-medium text-foreground">{config.label}</Label>
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground hover:text-foreground">
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{config.description}</TooltipContent>
          </Tooltip>
        </div>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{value}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={0}
        max={100}
        step={1}
      />
    </div>
  );
}
