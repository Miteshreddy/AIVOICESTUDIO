import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Sparkles, Loader2, Cpu } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SelectedVoiceCard } from "./components/SelectedVoiceCard";
import { GenerationSettingsPanel } from "./components/GenerationSettingsPanel";
import { GenerationResult } from "./components/GenerationResult";
import { useGenerateSpeechStore } from "./store/generate-speech-store";
import { estimateSpeechDuration, formatDuration } from "@/lib/utils";
import { EngineStatusBanner } from "@/components/shared/EngineStatusBanner";
import { useEngineStatus } from "@/hooks/useEngineStatus";
import { useElapsedSeconds } from "@/hooks/useElapsedSeconds";
import { useRealVoicesStore } from "@/store/real-voices-store";
import { useGenerationsStore } from "@/store/generations-store";

const SAMPLE_SCRIPTS = [
  {
    label: "Narration",
    text: "The old lighthouse had stood on that cliff for over a century, its beam sweeping across the water every night without fail, a quiet promise to anyone lost in the dark.",
  },
  {
    label: "Conversational",
    text: "Okay, so here's the thing — I really wasn't expecting that to work on the first try, but somehow it did, and now I'm just sitting here trying to figure out what I did right.",
  },
  {
    label: "Advertisement",
    text: "Introducing the all-new experience you've been waiting for. Faster, smarter, and built around you. Try it today, and see exactly why everyone's talking about it.",
  },
  {
    label: "Documentary",
    text: "Deep beneath the surface, in a world untouched by sunlight, life has found a way to survive — adapting, evolving, thriving in conditions that would be lethal anywhere else on Earth.",
  },
];

export default function GenerateSpeechPage() {
  const { setSelectedVoice, text, setText, isGenerating, generationStartedAt, generate } =
    useGenerateSpeechStore();
  const { ready: engineReady } = useEngineStatus();
  const elapsedSeconds = useElapsedSeconds(generationStartedAt);
  const [searchParams] = useSearchParams();
  const { voices: realVoices, loaded: realVoicesLoaded, refresh: refreshRealVoices } = useRealVoicesStore();
  const { generations, loaded: generationsLoaded, refresh: refreshGenerations } = useGenerationsStore();

  useEffect(() => {
    if (!realVoicesLoaded) refreshRealVoices();
  }, [realVoicesLoaded, refreshRealVoices]);

  useEffect(() => {
    if (!generationsLoaded) refreshGenerations();
  }, [generationsLoaded, refreshGenerations]);

  useEffect(() => {
    const requestedId = searchParams.get("voiceId");
    if (!requestedId || !realVoicesLoaded) return;
    const match = realVoices.find((v) => v.id === requestedId);
    if (match) setSelectedVoice(match.id, match.name);
  }, [searchParams, realVoices, realVoicesLoaded, setSelectedVoice]);

  const duration = estimateSpeechDuration(text);

  return (
    <div className="container max-w-6xl space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Generate Speech</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a voice and turn text into speech — synthesized locally on your GPU.
        </p>
      </div>

      <EngineStatusBanner />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 p-5">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type or paste the script you want to generate…"
                className="min-h-64"
              />

              {!text.trim() && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Try a sample:</span>
                  {SAMPLE_SCRIPTS.map((sample) => (
                    <button
                      key={sample.label}
                      type="button"
                      onClick={() => setText(sample.text)}
                      className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>~{formatDuration(duration)}</span>
                  <Badge variant="outline" className="font-normal">
                    {text.trim().split(/\s+/).filter(Boolean).length} words
                  </Badge>
                  <Badge variant="secondary" className="gap-1 font-normal">
                    <Cpu className="h-3 w-3" /> Local inference
                  </Badge>
                </div>
                <Button variant="brand" size="lg" onClick={generate} disabled={isGenerating || !text.trim()}>
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {isGenerating
                    ? !engineReady
                      ? "Warming up the engine…"
                      : `Generating… ${elapsedSeconds}s`
                    : "Generate Speech"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {generations.some((g) => g.status !== "archived") && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Recent generations</p>
              {generations
                .filter((g) => g.status !== "archived")
                .slice(0, 10)
                .map((g) => (
                  <GenerationResult key={g.id} generation={g} />
                ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <SelectedVoiceCard />
          <GenerationSettingsPanel />
        </div>
      </div>
    </div>
  );
}
