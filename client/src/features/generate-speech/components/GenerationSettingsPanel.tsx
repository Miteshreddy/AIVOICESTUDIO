import { Info, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useGenerateSpeechStore } from "../store/generate-speech-store";

const controls = [
  {
    key: "expressiveness" as const,
    label: "Expressiveness",
    description: "How much emotional emphasis and dynamic range the delivery has. Higher is punchier and more animated.",
    setterKey: "setExpressiveness" as const,
  },
  {
    key: "stability" as const,
    label: "Stability",
    description: "How closely the output sticks to the reference voice's tone. Higher is more consistent, lower allows more variation.",
    setterKey: "setStability" as const,
  },
  {
    key: "creativity" as const,
    label: "Creativity",
    description: "Randomness in delivery. Higher gives more natural variation between takes, lower is more predictable.",
    setterKey: "setCreativity" as const,
  },
];

export function GenerationSettingsPanel() {
  const store = useGenerateSpeechStore();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Voice Settings</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => {
            store.setExpressiveness(45);
            store.setStability(60);
            store.setCreativity(60);
          }}
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {controls.map((control) => (
          <div key={control.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs font-medium">{control.label}</Label>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground">
                      <Info className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-56">
                    {control.description}
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {store[control.key]}
              </span>
            </div>
            <Slider
              value={[store[control.key]]}
              onValueChange={([v]) => store[control.setterKey](v)}
              min={0}
              max={100}
              step={1}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
