import { useState } from "react";
import { ChevronDown, Play, Pause, Loader2, Sparkles, Library } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VoicePickerDialog } from "@/components/shared/VoicePickerDialog";
import { useVoicePreview } from "@/hooks/useVoicePreview";
import { useRealVoicesStore } from "@/store/real-voices-store";
import { useGenerateSpeechStore } from "../store/generate-speech-store";

export function SelectedVoiceCard() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { selectedVoiceId, selectedVoiceName, setSelectedVoice } = useGenerateSpeechStore();
  const { voices } = useRealVoicesStore();
  const { toggle, loadingId, playingId } = useVoicePreview();

  const selectedVoice = voices.find((v) => v.id === selectedVoiceId);
  const isPlaying = selectedVoiceId ? playingId === selectedVoiceId : false;
  const isLoadingPreview = selectedVoiceId ? loadingId === selectedVoiceId : false;

  return (
    <>
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <button
            onClick={() => selectedVoiceId && toggle(selectedVoiceId)}
            disabled={!selectedVoiceId || isLoadingPreview}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-base font-semibold text-white transition-transform hover:scale-105 disabled:opacity-60"
          >
            {isLoadingPreview ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : selectedVoiceId ? (
              <Play className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </button>

          <button
            className="focus-ring flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary"
            onClick={() => setPickerOpen(true)}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{selectedVoiceName}</p>
              {selectedVoice ? (
                <p className="truncate text-xs text-muted-foreground">
                  {selectedVoice.description || selectedVoice.tags.join(", ")}
                </p>
              ) : (
                <p className="truncate text-xs text-muted-foreground">Built-in engine voice</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {selectedVoice?.source === "library" && (
                <Badge variant="secondary" className="gap-1">
                  <Library className="h-2.5 w-2.5" /> Library
                </Badge>
              )}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        </CardContent>
      </Card>

      <VoicePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedId={selectedVoiceId}
        onSelect={(voice) => setSelectedVoice(voice.id, voice.name)}
      />
    </>
  );
}
