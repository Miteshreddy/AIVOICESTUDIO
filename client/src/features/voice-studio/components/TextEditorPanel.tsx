import { useMemo } from "react";
import { Sparkles, Loader2, Cpu } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TextEditorToolbar } from "./TextEditorToolbar";
import { useVoiceStudioStore } from "../store/voice-studio-store";
import { estimateSpeechDuration, formatDuration } from "@/lib/utils";
import { calculateReadability } from "@/lib/readability";
import { generateSpeechAudio } from "@/services/tts-service";
import { ApiError } from "@/services/api-client";
import { EngineStatusBanner } from "@/components/shared/EngineStatusBanner";
import { AudioPlayerBar } from "@/components/shared/AudioPlayerBar";
import { useAudioPlayerStore } from "@/store/audio-player-store";
import { useEngineStatus } from "@/hooks/useEngineStatus";

const PREVIEW_PLAYER_ID = "voice-studio-preview";

export function TextEditorPanel() {
  const { text, setText, isGenerating, setGenerating, attributes, previewAudioUrl, setPreviewAudioUrl } =
    useVoiceStudioStore();
  const { ready: engineReady } = useEngineStatus();

  const wordCount = useMemo(() => text.trim().split(/\s+/).filter(Boolean).length, [text]);
  const charCount = text.length;
  const duration = useMemo(() => estimateSpeechDuration(text), [text]);
  const readability = useMemo(() => calculateReadability(text), [text]);

  async function handleGenerate() {
    if (!text.trim()) {
      toast.warning("Write some text to generate speech from.");
      return;
    }
    setGenerating(true);
    try {
      // Map studio sliders (0-100) onto Chatterbox's exaggeration/cfg-weight controls (0-1).
      const exaggeration = (attributes.energy + attributes.confidence) / 200;
      const cfgWeight = (attributes.professionalism + attributes.naturalness) / 200;

      const url = await generateSpeechAudio({ text, exaggeration, cfgWeight });
      setPreviewAudioUrl(url);
      useAudioPlayerStore.getState().play(PREVIEW_PLAYER_ID, url);
      toast.success("Preview regenerated.");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Couldn't reach the local TTS engine — is it running? (cd ml-service && python -m app.main)",
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <TextEditorToolbar text={text} onResult={setText} />

      <div className="px-6 pt-4">
        <EngineStatusBanner />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Start writing, or paste a script here…"
          className="h-full min-h-[300px] resize-none border-none bg-transparent p-0 text-base leading-relaxed shadow-none focus-visible:ring-0"
        />
      </div>

      {previewAudioUrl && (
        <div className="border-t border-border px-6 py-3">
          <AudioPlayerBar id={PREVIEW_PLAYER_ID} url={previewAudioUrl} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{wordCount} words</span>
          <span>·</span>
          <span>{charCount} characters</span>
          <span>·</span>
          <span>~{formatDuration(duration)}</span>
          <span>·</span>
          <Badge variant="outline" className="font-normal">
            Readability: {readability.label} ({readability.score})
          </Badge>
          <Badge variant="secondary" className="gap-1 font-normal">
            <Cpu className="h-3 w-3" /> Local
          </Badge>
        </div>

        <Button variant="brand" onClick={handleGenerate} disabled={isGenerating}>
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isGenerating && !engineReady ? "Warming up the engine…" : "Generate Preview"}
        </Button>
      </div>
    </div>
  );
}
