import { RotateCcw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { VoiceSlider } from "./VoiceSlider";
import { sliderGroups } from "../data/slider-config";
import { useVoiceStudioStore } from "../store/voice-studio-store";

export function VoiceControlsPanel() {
  const { attributes, setAttribute, resetAttributes } = useVoiceStudioStore();

  return (
    <div className="flex h-full flex-col border-l border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-xs font-medium text-muted-foreground">Voice Controls</p>
        <Button variant="ghost" size="sm" onClick={resetAttributes} className="h-7 px-2 text-xs">
          <RotateCcw className="h-3 w-3" /> Reset
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <Accordion type="multiple" defaultValue={sliderGroups.map((g) => g.id)} className="px-4">
          {sliderGroups.map((group) => (
            <AccordionItem key={group.id} value={group.id}>
              <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  {group.sliders.map((slider) => (
                    <VoiceSlider
                      key={slider.key}
                      config={slider}
                      value={attributes[slider.key]}
                      onChange={(v) => setAttribute(slider.key, v)}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollArea>
    </div>
  );
}
