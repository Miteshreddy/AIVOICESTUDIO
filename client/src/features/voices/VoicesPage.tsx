import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Pause, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { VoiceOrb } from "@/components/studio/VoiceOrb";
import { ProBadge } from "@/components/studio/ProBadge";
import { useVoices } from "@/hooks/useVoices";
import { useVoicePreview } from "@/hooks/useVoicePreview";
import { useRealVoicesStore } from "@/store/real-voices-store";
import type { RemoteVoiceSummary } from "@/services/tts-service";
import { useSpeechStore } from "@/features/speech/speech-store";
import { CloneVoiceDialog } from "./CloneVoiceDialog";

function VoiceCard({ voice, deletable }: { voice: RemoteVoiceSummary; deletable?: boolean }) {
  const { toggle, playingId, loadingId } = useVoicePreview();
  const navigate = useNavigate();
  const playing = playingId === voice.id;
  const loading = loadingId === voice.id;

  return (
    <div className="studio-surface animate-rise-in group flex flex-col p-5 transition hover:border-border">
      <div className="flex items-start justify-between">
        <VoiceOrb seed={voice.id} size={56} active={playing} />
        {deletable && (
          <button
            type="button"
            onClick={async () => {
              if (!confirm(`Delete ${voice.name}? This can't be undone.`)) return;
              try {
                await useRealVoicesStore.getState().removeVoice(voice.id);
                toast.success(`${voice.name} deleted.`);
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
            className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:bg-secondary hover:text-destructive group-hover:opacity-100"
            aria-label={`Delete ${voice.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <h3 className="mt-4 flex items-center gap-2 font-heading text-lg font-semibold">
        {voice.name}
        {voice.fineTuned && <ProBadge />}
      </h3>
      <p className="mt-0.5 text-sm text-muted-foreground">{voice.description || "Your cloned voice"}</p>
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => toggle(voice.id)}
          className="flex h-9 items-center gap-2 rounded-full bg-secondary px-4 text-sm transition hover:bg-secondary/70"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : playing ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {playing ? "Stop" : "Listen"}
        </button>
        <button
          type="button"
          onClick={() => {
            useSpeechStore.getState().setVoice(voice.id, voice.name);
            navigate("/");
          }}
          className="flex h-9 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background transition hover:opacity-90"
        >
          Use voice
        </button>
      </div>
    </div>
  );
}

export default function VoicesPage() {
  const { featured, mine, loaded, connecting } = useVoices();
  const [params, setParams] = useSearchParams();
  const [cloneOpen, setCloneOpen] = useState(params.get("clone") === "1");

  const female = featured.filter((v) => v.gender === "female");
  const male = featured.filter((v) => v.gender !== "female");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Voices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real human voices, hand-picked for how natural they sound. Or clone your own.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCloneOpen(true)}
          className="flex h-10 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Clone a voice
        </button>
      </div>

      {!loaded && (
        <div className="mt-20 flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          {connecting && (
            <p className="max-w-sm text-sm text-muted-foreground">
              Starting the voice engine… your voices will appear here automatically in a few seconds.
            </p>
          )}
        </div>
      )}

      {[
        { title: "Female", voices: female },
        { title: "Male", voices: male },
      ].map(
        (group) =>
          group.voices.length > 0 && (
            <section key={group.title} className="mt-10">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{group.title}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.voices.map((v) => (
                  <VoiceCard key={v.id} voice={v} />
                ))}
              </div>
            </section>
          ),
      )}

      <section className={loaded ? "mt-12" : "hidden"}>
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Your voices</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mine.map((v) => (
            <VoiceCard key={v.id} voice={v} deletable />
          ))}
          <button
            type="button"
            onClick={() => setCloneOpen(true)}
            className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border text-muted-foreground transition hover:border-primary/50 hover:bg-secondary/30 hover:text-foreground"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-secondary">
              <Plus className="h-5 w-5" />
            </span>
            <span className="text-sm">Clone a voice from a recording</span>
          </button>
        </div>
      </section>

      <CloneVoiceDialog
        open={cloneOpen}
        onOpenChange={(o) => {
          setCloneOpen(o);
          if (!o && params.get("clone")) setParams({}, { replace: true });
        }}
        onCreated={() => undefined}
      />
    </div>
  );
}
