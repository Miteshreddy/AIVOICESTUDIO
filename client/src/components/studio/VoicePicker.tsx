import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, Loader2, Pause, Play, Plus, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useVoices } from "@/hooks/useVoices";
import { useVoicePreview } from "@/hooks/useVoicePreview";
import type { RemoteVoiceSummary } from "@/services/tts-service";
import { cn } from "@/lib/utils";
import { VoiceOrb } from "./VoiceOrb";
import { ProBadge } from "./ProBadge";

function VoiceRow({
  voice,
  selected,
  onSelect,
}: {
  voice: RemoteVoiceSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const { toggle, playingId, loadingId } = useVoicePreview();
  const playing = playingId === voice.id;
  const loading = loadingId === voice.id;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-xl px-2.5 py-2 transition",
        selected ? "bg-secondary" : "hover:bg-secondary/60",
      )}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <VoiceOrb seed={voice.id} size={34} active={playing} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            {voice.name}
            {voice.fineTuned && <ProBadge />}
          </p>
          <p className="truncate text-xs text-muted-foreground">{voice.description || "Your cloned voice"}</p>
        </div>
      </button>
      <button
        type="button"
        onClick={() => toggle(voice.id)}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground opacity-70 transition hover:bg-background hover:text-foreground group-hover:opacity-100"
        aria-label={`Preview ${voice.name}`}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : playing ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </button>
      {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
    </div>
  );
}

/** Compact voice selector — orb + name, opens a searchable list with previews. */
export function VoicePicker({
  value,
  onChange,
  className,
}: {
  value: string | null;
  onChange: (voice: RemoteVoiceSummary) => void;
  className?: string;
}) {
  const { all, featured, mine, loaded } = useVoices();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = all.find((v) => v.id === value) ?? null;

  // Fall back to the first featured voice so there's always a real voice selected.
  useEffect(() => {
    if (loaded && !selected && featured[0]) onChange(featured[0]);
  }, [loaded, selected, featured, onChange]);

  const q = query.trim().toLowerCase();
  const match = (v: RemoteVoiceSummary) =>
    !q || v.name.toLowerCase().includes(q) || v.description.toLowerCase().includes(q) || v.gender === q;

  const groups = [
    { title: "Featured", voices: featured.filter(match) },
    { title: "Your voices", voices: mine.filter(match) },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-background/60 px-3 py-2.5 text-left transition hover:border-border hover:bg-secondary/40",
            className,
          )}
        >
          {selected ? (
            <>
              <VoiceOrb seed={selected.id} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{selected.name}</p>
                <p className="truncate text-xs text-muted-foreground">{selected.description || "Your cloned voice"}</p>
              </div>
            </>
          ) : (
            <p className="flex-1 text-sm text-muted-foreground">{loaded ? "Choose a voice" : "Loading voices…"}</p>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,360px)] rounded-2xl p-2">
        <div className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search voices"
            className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="mt-2 max-h-80 overflow-y-auto">
          {groups.map(
            (g) =>
              g.voices.length > 0 && (
                <div key={g.title} className="mb-1">
                  <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {g.title}
                  </p>
                  {g.voices.map((v) => (
                    <VoiceRow
                      key={v.id}
                      voice={v}
                      selected={v.id === value}
                      onSelect={() => {
                        onChange(v);
                        setOpen(false);
                      }}
                    />
                  ))}
                </div>
              ),
          )}
        </div>
        <Link
          to="/voices?clone=1"
          onClick={() => setOpen(false)}
          className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> Clone a new voice
        </Link>
      </PopoverContent>
    </Popover>
  );
}
