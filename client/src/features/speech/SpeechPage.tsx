import { useCallback, useEffect, useState } from "react";
import { ArrowUp, Loader2, RotateCcw, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { VoicePicker } from "@/components/studio/VoicePicker";
import { useElapsedSeconds } from "@/hooks/useElapsedSeconds";
import { useEngineStatus } from "@/hooks/useEngineStatus";
import { generateSpeechAudio, type RemoteVoiceSummary } from "@/services/tts-service";
import { ApiError } from "@/services/api-client";
import { useGenerationsStore } from "@/store/generations-store";
import { useNowPlayingStore } from "@/store/now-playing-store";
import { cn } from "@/lib/utils";
import { DEFAULT_SETTINGS, useSpeechStore, type SpeechSettings } from "./speech-store";
import { PronunciationsPanel } from "./PronunciationsPanel";

const MAX_CHARS = 20_000;

const STARTERS = [
  {
    label: "Tell a story",
    text: "The rain hadn't stopped for three days. Mara pulled her coat tighter, glanced back at the empty street, and finally knocked. Once. Twice. And then, slowly, the door creaked open.",
  },
  {
    label: "Podcast intro",
    text: "Hey everyone, and welcome back to the show! I'm so glad you're here. Today's episode is a big one — we're talking about how tiny daily habits quietly change your entire life.",
  },
  {
    label: "Product ad",
    text: "Meet the headphones that actually get you. Twenty hours of battery, noise cancelling that just works, and a sound so clear you'll hear things you've never noticed before.",
  },
  {
    label: "Explainer",
    text: "So, how does a rainbow actually form? When sunlight enters a raindrop, it bends, reflects off the back, and bends again on the way out — splitting white light into every colour you can see.",
  },
  {
    label: "Audiobook",
    text: "Chapter One. It was the kind of morning that made you believe in second chances. The sky was clean, the air smelled of cut grass, and for the first time in years, Daniel wasn't afraid.",
  },
];

const CONTROLS: {
  key: keyof SpeechSettings;
  label: string;
  left: string;
  right: string;
  min: number;
  max: number;
}[] = [
  { key: "stability", label: "Stability", left: "More natural variation", right: "More consistent", min: 0, max: 100 },
  { key: "speed", label: "Speed", left: "Slower", right: "Faster", min: 70, max: 130 },
];

function estimateSeconds(text: string) {
  return Math.max(1, Math.round(text.trim().split(/\s+/).filter(Boolean).length / 2.6));
}

export default function SpeechPage() {
  const store = useSpeechStore();
  const { ready } = useEngineStatus();
  const openPlayer = useNowPlayingStore((s) => s.open);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const elapsed = useElapsedSeconds(startedAt);

  const setVoice = useCallback(
    (v: RemoteVoiceSummary) => useSpeechStore.getState().setVoice(v.id, v.name),
    [],
  );

  const busy = startedAt !== null;
  const canGenerate = store.text.trim().length > 0 && !!store.voiceId && !busy;

  const generate = useCallback(async () => {
    const { text, voiceId, voiceName, stability, speed, takes } = useSpeechStore.getState();
    if (!text.trim() || !voiceId || startedAt) return;
    setStartedAt(Date.now());
    try {
      const url = await generateSpeechAudio({
        text,
        voiceId,
        stability: stability / 100,
        speed: speed / 100,
        takes,
      });
      const history = useGenerationsStore.getState();
      await history.refresh();
      const latest = useGenerationsStore.getState().generations[0];
      if (latest) history.seedAudioUrl(latest.id, url);
      openPlayer({
        id: latest ? `gen:${latest.id}` : `gen:${Date.now()}`,
        title: text.trim().slice(0, 60) + (text.trim().length > 60 ? "…" : ""),
        subtitle: voiceName,
        url,
        orbSeed: voiceId,
        downloadName: `${voiceName}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.wav`,
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Generation failed — is the engine running?");
    } finally {
      setStartedAt(null);
    }
  }, [startedAt, openPlayer]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void generate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [generate]);

  const chars = store.text.length;
  const est = estimateSeconds(store.text);
  const isDefault = CONTROLS.every((c) => store[c.key] === DEFAULT_SETTINGS[c.key]);

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-8 lg:flex-row lg:py-10">
      {/* Editor */}
      <section className="flex min-h-[55vh] flex-1 flex-col">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          What should we <span className="text-gradient-brand">say</span>?
        </h1>
        <div className="studio-surface mt-5 flex flex-1 flex-col p-1.5 shadow-sm focus-within:border-primary/50">
          <textarea
            value={store.text}
            onChange={(e) => store.setText(e.target.value.slice(0, MAX_CHARS))}
            placeholder="Start typing, or paste a script. Punctuation shapes the delivery — commas pause, questions rise, exclamations lift."
            className="min-h-[260px] flex-1 resize-none bg-transparent px-4 py-3.5 text-[17px] leading-relaxed outline-none placeholder:text-muted-foreground/70"
            spellCheck
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-3 py-2.5">
            <p className="font-mono text-xs tabular-nums text-muted-foreground">
              {chars.toLocaleString()} / {MAX_CHARS.toLocaleString()}
              {chars > 0 && <span className="ml-3">≈ {est}s of audio</span>}
            </p>
            <button
              type="button"
              onClick={generate}
              disabled={!canGenerate}
              className={cn(
                "flex h-10 items-center gap-2 rounded-full px-5 text-sm font-medium transition",
                canGenerate
                  ? "bg-foreground text-background hover:opacity-90 active:scale-[.98]"
                  : "cursor-not-allowed bg-secondary text-muted-foreground",
              )}
              title="Ctrl + Enter"
            >
              {busy ? (
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

        {store.text.length === 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => store.setText(s.text)}
                className="rounded-full border border-border/70 px-3.5 py-1.5 text-xs text-muted-foreground transition hover:border-border hover:bg-secondary/60 hover:text-foreground"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        {busy && !ready && (
          <p className="mt-3 text-xs text-muted-foreground">The voice model is still warming up — the first take takes a little longer.</p>
        )}
      </section>

      {/* Voice + settings */}
      <aside className="w-full shrink-0 space-y-4 lg:w-80 lg:pt-[3.75rem]">
        <div className="studio-surface space-y-3 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Voice</p>
          <VoicePicker value={store.voiceId} onChange={setVoice} />
        </div>

        <div className="studio-surface p-4">
          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            className="flex w-full items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground lg:pointer-events-none"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Delivery
            </span>
            {!isDefault && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  store.resetSettings();
                }}
                className="pointer-events-auto flex items-center gap-1 normal-case tracking-normal hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </span>
            )}
          </button>
          <div className={cn("mt-4 space-y-6", !showSettings && "hidden lg:block")}>
            <div className="space-y-2">
              <span className="text-sm">Quality</span>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary/60 p-1">
                {([
                  [2, "Best", "Re-records any passage that comes out weak"],
                  [1, "Fast", "Single take, slightly quicker"],
                ] as const).map(([value, label, hint]) => (
                  <button
                    key={value}
                    type="button"
                    title={hint}
                    onClick={() => store.setTakes(value)}
                    className={cn(
                      "rounded-lg py-1.5 text-xs transition",
                      store.takes === value ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {CONTROLS.map((c) => (
              <div key={c.key} className="space-y-2.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm">{c.label}</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {c.key === "speed" ? `${(store.speed / 100).toFixed(2)}×` : store[c.key]}
                  </span>
                </div>
                <Slider
                  value={[store[c.key]]}
                  min={c.min}
                  max={c.max}
                  step={1}
                  onValueChange={([v]) => store.setSetting(c.key, v)}
                />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>{c.left}</span>
                  <span>{c.right}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <PronunciationsPanel />
      </aside>
    </div>
  );
}
