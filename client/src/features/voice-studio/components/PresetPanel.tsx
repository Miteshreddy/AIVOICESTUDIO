import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { voicePresets } from "../data/presets";
import { useVoiceStudioStore } from "../store/voice-studio-store";

export function PresetPanel() {
  const { activePresetId, applyPreset, voiceName, setVoiceName } = useVoiceStudioStore();

  return (
    <div className="flex h-full flex-col border-r border-border">
      <div className="space-y-2 border-b border-border p-4">
        <Label htmlFor="voice-name" className="text-xs text-muted-foreground">
          Voice name
        </Label>
        <Input
          id="voice-name"
          value={voiceName}
          onChange={(e) => setVoiceName(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      <div className="border-b border-border px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground">Presets</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1 p-3">
          {voicePresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className={cn(
                "focus-ring flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary",
                activePresetId === preset.id && "bg-primary/10 ring-1 ring-inset ring-primary/30",
              )}
            >
              <preset.icon
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  activePresetId === preset.id ? "text-primary" : "text-muted-foreground",
                )}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">{preset.label}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground">{preset.description}</p>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
