import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Loader2, Pause, Play, Search, Trash2, Type } from "lucide-react";
import { toast } from "sonner";
import { VoiceOrb } from "@/components/studio/VoiceOrb";
import { useGenerationsStore } from "@/store/generations-store";
import { useAudioPlayerStore } from "@/store/audio-player-store";
import { useNowPlayingStore } from "@/store/now-playing-store";
import { useSpeechStore } from "@/features/speech/speech-store";
import type { GenerationRecord } from "@/services/tts-service";

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function kind(g: GenerationRecord) {
  if (g.voiceName === "Sound effect") return "Sound effect";
  if (g.text === "[Voice changer]") return "Voice changer";
  return "Speech";
}

function Row({ g }: { g: GenerationRecord }) {
  const { getAudioUrl, remove } = useGenerationsStore();
  const { playingId, isPaused, toggle } = useAudioPlayerStore();
  const openPlayer = useNowPlayingStore((s) => s.open);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const pid = `gen:${g.id}`;
  const playing = playingId === pid && !isPaused;
  const type = kind(g);

  async function play() {
    if (playingId === pid) return toggle(pid, "");
    setLoading(true);
    try {
      const url = await getAudioUrl(g.id);
      openPlayer({
        id: pid,
        title: type === "Speech" ? g.text.slice(0, 60) : type === "Sound effect" ? g.text : `Voice changer · ${g.voiceName}`,
        subtitle: type === "Speech" ? g.voiceName : type,
        url,
        orbSeed: g.voiceId ?? g.id,
        downloadName: `${g.voiceName}-${g.id.slice(0, 8)}.wav`,
      });
    } catch {
      toast.error("Couldn't load that audio.");
    } finally {
      setLoading(false);
    }
  }

  async function download() {
    const url = await getAudioUrl(g.id);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${g.voiceName}-${g.id.slice(0, 8)}.wav`;
    a.click();
  }

  return (
    <div className="group flex items-center gap-4 rounded-2xl px-3 py-3 transition hover:bg-secondary/50">
      <button
        type="button"
        onClick={play}
        className="relative grid h-11 w-11 shrink-0 place-items-center"
        aria-label={playing ? "Pause" : "Play"}
      >
        <VoiceOrb seed={g.voiceId ?? g.id} size={44} active={playing} />
        <span className="absolute inset-0 grid place-items-center rounded-full bg-black/25 text-white opacity-0 transition group-hover:opacity-100">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm">{type === "Voice changer" ? "Converted recording" : g.text}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {type === "Speech" ? g.voiceName : type === "Voice changer" ? `Voice changer · ${g.voiceName}` : type} ·{" "}
          {g.durationSeconds.toFixed(1)}s · {new Date(g.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition group-hover:opacity-100">
        {type === "Speech" && (
          <button
            type="button"
            onClick={() => {
              const s = useSpeechStore.getState();
              s.setText(g.text);
              if (g.voiceId) s.setVoice(g.voiceId, g.voiceName);
              navigate("/");
            }}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
            aria-label="Open in editor"
            title="Open in editor"
          >
            <Type className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={download}
          className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
          aria-label="Download"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => remove(g.id)}
          className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-destructive"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const { generations, loaded, refresh } = useGenerationsStore();
  const [query, setQuery] = useState("");

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = generations.filter(
      (g) => g.status !== "archived" && (!q || g.text.toLowerCase().includes(q) || g.voiceName.toLowerCase().includes(q)),
    );
    const map = new Map<string, GenerationRecord[]>();
    for (const g of filtered) {
      const k = dayLabel(g.createdAt);
      map.set(k, [...(map.get(k) ?? []), g]);
    }
    return [...map.entries()];
  }, [generations, query]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">History</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything you've generated, saved on this computer.</p>
        </div>
        <div className="flex h-10 w-full items-center gap-2 rounded-full border border-border/70 px-4 sm:w-64">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {!loaded ? (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : groups.length === 0 ? (
        <p className="mt-16 text-center text-sm text-muted-foreground">
          {query ? "Nothing matches that search." : "Nothing here yet — generate something and it'll show up here."}
        </p>
      ) : (
        groups.map(([day, items]) => (
          <section key={day} className="mt-8">
            <h2 className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{day}</h2>
            <div className="mt-2">
              {items.map((g) => (
                <Row key={g.id} g={g} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
