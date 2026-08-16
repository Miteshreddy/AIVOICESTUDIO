import { Download, Sparkles, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnimatedWaveform } from "@/components/shared/AnimatedWaveform";
import { AudioFileUploader } from "@/components/shared/AudioFileUploader";
import { EngineStatusBanner } from "@/components/shared/EngineStatusBanner";
import { AudioPlayerBar } from "@/components/shared/AudioPlayerBar";
import { OperationRow } from "./components/OperationRow";
import { EqPresetSelector } from "./components/EqPresetSelector";
import { useAudioCleanupStore, type OperationKey } from "./store/audio-cleanup-store";

const operations: { key: OperationKey; label: string; description: string }[] = [
  { key: "noiseRemoval", label: "Remove Noise", description: "Suppress steady background hiss and hum." },
  { key: "echoRemoval", label: "Remove Echo", description: "Reduce room reflections and reverb tails." },
  { key: "normalize", label: "Normalize", description: "Bring output to a consistent target loudness." },
  { key: "silenceRemoval", label: "Silence Removal", description: "Trim dead air between phrases." },
  { key: "volumeLeveling", label: "Volume Leveling", description: "Even out loud and quiet passages." },
  { key: "aiEnhancement", label: "AI Enhancement", description: "Combined noise reduction + presence EQ restoration pass." },
  { key: "compressor", label: "Compressor", description: "Reduce dynamic range for a punchier result." },
  { key: "limiter", label: "Limiter", description: "Hard ceiling to prevent clipping on peaks." },
];

function downloadResult(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

export default function AudioCleanupPage() {
  const store = useAudioCleanupStore();

  return (
    <div className="container max-w-3xl space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audio Cleanup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Restore and polish recordings before they hit your timeline — processed locally, no upload.
        </p>
      </div>

      <EngineStatusBanner />

      <AudioFileUploader file={store.file} onFile={store.setFile} onClear={store.reset} />

      {store.file && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">EQ Preset</CardTitle>
            </CardHeader>
            <CardContent>
              <EqPresetSelector value={store.eqPreset} onChange={store.setEqPreset} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {operations.map((op) => (
              <OperationRow
                key={op.key}
                label={op.label}
                description={op.description}
                operation={store[op.key]}
                onToggle={() => store.toggleOperation(op.key)}
                onAmountChange={(v) => store.setAmount(op.key, v)}
              />
            ))}
          </div>

          <Card>
            <CardContent className="space-y-4 p-6">
              {store.status === "idle" && (
                <div className="flex items-center justify-between">
                  <AnimatedWaveform bars={20} className="h-8 opacity-40" />
                  <Button variant="brand" onClick={store.process}>
                    <Sparkles className="h-4 w-4" /> Process Audio
                  </Button>
                </div>
              )}
              {store.status === "processing" && (
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" /> Processing on your GPU/CPU…
                </div>
              )}
              {store.status === "done" && store.resultUrl && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-success">
                      <CheckCircle2 className="h-4 w-4" /> Processing complete
                    </div>
                    <Button
                      variant="brand"
                      onClick={() => downloadResult(store.resultUrl!, `${store.file!.name.replace(/\.[^.]+$/, "")}-cleaned.wav`)}
                    >
                      <Download className="h-4 w-4" /> Download result
                    </Button>
                  </div>
                  <AudioPlayerBar id="audio-cleanup-result" url={store.resultUrl} />
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
