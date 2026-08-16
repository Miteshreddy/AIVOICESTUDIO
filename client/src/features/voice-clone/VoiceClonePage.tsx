import { useState } from "react";
import { CheckCircle2, Loader2, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UploadDropzone } from "./components/UploadDropzone";
import { AnalyzingState } from "./components/AnalyzingState";
import { AnalysisResults } from "./components/AnalysisResults";
import { TrainingProgress } from "./components/TrainingProgress";
import { useVoiceCloneStore } from "./store/voice-clone-store";
import { generateSpeechAudio } from "@/services/tts-service";
import { ApiError } from "@/services/api-client";
import { EngineStatusBanner } from "@/components/shared/EngineStatusBanner";
import { AudioPlayerBar } from "@/components/shared/AudioPlayerBar";
import { useAudioPlayerStore } from "@/store/audio-player-store";
import { useEngineStatus } from "@/hooks/useEngineStatus";

const TRY_PLAYER_ID = "voice-clone-try";

export default function VoiceClonePage() {
  const { step, analysis, trainingProgress, clonedVoiceId, startTraining, reset } = useVoiceCloneStore();
  const { ready: engineReady } = useEngineStatus();
  const [voiceName, setVoiceName] = useState("My Voice");
  const [tryText, setTryText] = useState("Hey, this is what my cloned voice sounds like.");
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  async function handleTry() {
    if (!clonedVoiceId) return;
    setGenerating(true);
    try {
      const url = await generateSpeechAudio({ voiceId: clonedVoiceId, text: tryText });
      setAudioUrl(url);
      useAudioPlayerStore.getState().play(TRY_PLAYER_ID, url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="container max-w-2xl space-y-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clone Voice</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload 6–30 seconds of clean audio — cloned locally on your GPU, zero-shot.
        </p>
      </div>

      <EngineStatusBanner />

      {step === "upload" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="voice-name" className="text-xs">
              Voice name
            </Label>
            <Input id="voice-name" value={voiceName} onChange={(e) => setVoiceName(e.target.value)} />
          </div>
          <UploadDropzone />
        </div>
      )}
      {step === "analyzing" && <AnalyzingState />}
      {step === "review" && analysis && (
        <AnalysisResults analysis={analysis} onTrain={() => startTraining(voiceName)} onBack={reset} />
      )}
      {step === "training" && <TrainingProgress progress={trainingProgress} />}
      {step === "complete" && (
        <div className="flex flex-col items-center gap-5 py-16 text-center">
          <CheckCircle2 className="h-12 w-12 text-success" />
          <div>
            <p className="text-lg font-semibold">"{voiceName}" is ready</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cloned locally — try it below, or use it anywhere in the app.
            </p>
          </div>

          <div className="w-full max-w-md space-y-3 rounded-xl border border-border p-4 text-left">
            <Label className="text-xs">Try it</Label>
            <Textarea
              value={tryText}
              onChange={(e) => setTryText(e.target.value)}
              className="min-h-16"
            />
            <Button variant="brand" size="sm" onClick={handleTry} disabled={generating} className="w-full">
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {generating && !engineReady ? "Warming up the engine…" : "Generate"}
            </Button>
            {audioUrl && <AudioPlayerBar id={TRY_PLAYER_ID} url={audioUrl} />}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={reset}>
              Clone another
            </Button>
            <Button asChild variant="brand">
              <Link to="/app/voice-library">View in library</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
