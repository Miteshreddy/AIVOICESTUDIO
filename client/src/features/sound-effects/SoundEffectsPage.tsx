import { useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { useElapsedSeconds } from "@/hooks/useElapsedSeconds";
import { generateSoundEffect } from "@/services/tts-service";
import { ApiError } from "@/services/api-client";
import { useNowPlayingStore } from "@/store/now-playing-store";
import { useGenerationsStore } from "@/store/generations-store";
import { cn } from "@/lib/utils";

const IDEAS = [
  "Heavy rain on a tin roof, distant thunder",
  "Footsteps crunching through fresh snow",
  "Crackling campfire at night with crickets",
  "Spaceship door sliding open with a hiss",
  "Stadium crowd erupting into cheers",
  "Glass bottle shattering on concrete",
  "Old wooden door slowly creaking open",
  "Deep cinematic boom with a long tail",
];

export default function SoundEffectsPage() {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const elapsed = useElapsedSeconds(startedAt);
  const openPlayer = useNowPlayingStore((s) => s.open);
  const ready = prompt.trim().length > 1 && !startedAt;

  async function generate() {
    if (!ready) return;
    const text = prompt.trim();
    setStartedAt(Date.now());
    try {
      const url = await generateSoundEffect({ prompt: text, durationSeconds: duration, quality: "standard" });
      void useGenerationsStore.getState().refresh();
      openPlayer({
        id: `sfx:${Date.now()}`,
        title: text,
        subtitle: `Sound effect · ${duration}s`,
        url,
        orbSeed: text,
        downloadName: `${text.slice(0, 40).replace(/[^\w]+/g, "-")}.wav`,
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Generation failed — is the engine running?");
    } finally {
      setStartedAt(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 lg:py-10">
      <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Sound Effects</h1>
      <p className="mt-1 text-sm text-muted-foreground">Describe a sound. Be specific about the source, the space and the mood.</p>

      <div className="studio-surface mt-8 p-1.5 focus-within:border-primary/50">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, 300))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void generate();
            }
          }}
          rows={3}
          placeholder="Waves crashing against rocks, seagulls in the distance…"
          className="w-full resize-none bg-transparent px-4 py-3.5 text-[17px] leading-relaxed outline-none placeholder:text-muted-foreground/70"
        />
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 px-3 py-2.5">
          <div className="flex w-56 items-center gap-3">
            <span className="text-xs text-muted-foreground">Length</span>
            <Slider value={[duration]} min={1} max={20} step={1} onValueChange={([v]) => setDuration(v)} />
            <span className="w-8 font-mono text-xs tabular-nums text-muted-foreground">{duration}s</span>
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={!ready}
            className={cn(
              "flex h-10 items-center gap-2 rounded-full px-5 text-sm font-medium transition",
              ready ? "bg-foreground text-background hover:opacity-90" : "cursor-not-allowed bg-secondary text-muted-foreground",
            )}
          >
            {startedAt ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating · {elapsed}s
              </>
            ) : (
              <>
                Generate <ArrowUp className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {IDEAS.map((idea) => (
          <button
            key={idea}
            type="button"
            onClick={() => setPrompt(idea)}
            className="rounded-full border border-border/70 px-3.5 py-1.5 text-xs text-muted-foreground transition hover:border-border hover:bg-secondary/60 hover:text-foreground"
          >
            {idea}
          </button>
        ))}
      </div>
      {startedAt && elapsed > 25 && (
        <p className="mt-4 text-xs text-muted-foreground">
          First time? The sound model is loading onto your GPU — after this it only takes seconds.
        </p>
      )}
    </div>
  );
}
