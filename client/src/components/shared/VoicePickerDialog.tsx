import { useEffect, useMemo, useState } from "react";
import { Search, Play, Pause, Loader2, Sparkles, Library } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRealVoicesStore } from "@/store/real-voices-store";
import { useVoicePreview } from "@/hooks/useVoicePreview";
import { cn } from "@/lib/utils";
import type { RemoteVoiceSummary } from "@/services/tts-service";

type SourceFilter = "all" | "library" | "user";
type GenderFilter = "all" | "male" | "female";

export function VoicePickerDialog({
  open,
  onOpenChange,
  selectedId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId: string | null;
  onSelect: (voice: RemoteVoiceSummary) => void;
}) {
  const { voices, loaded, refresh } = useRealVoicesStore();
  const { toggle, loadingId, playingId } = useVoicePreview();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<SourceFilter>("all");
  const [gender, setGender] = useState<GenderFilter>("all");

  useEffect(() => {
    if (!loaded) refresh();
  }, [loaded, refresh]);

  const filtered = useMemo(() => {
    let result = voices;
    if (tab !== "all") result = result.filter((v) => v.source === tab);
    if (gender !== "all") result = result.filter((v) => v.gender === gender);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q) ||
          v.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [voices, tab, gender, search]);

  const libraryCount = voices.filter((v) => v.source === "library").length;
  const userCount = voices.filter((v) => v.source === "user").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-xl flex-col overflow-hidden p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>Select a voice</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 px-4 pt-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search voices…"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Tabs value={tab} onValueChange={(v) => setTab(v as SourceFilter)}>
              <TabsList>
                <TabsTrigger value="all">All ({voices.length})</TabsTrigger>
                <TabsTrigger value="library">Library ({libraryCount})</TabsTrigger>
                <TabsTrigger value="user">My Clones ({userCount})</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={gender} onValueChange={(v) => setGender(v as GenderFilter)}>
              <TabsList>
                <TabsTrigger value="all">Any</TabsTrigger>
                <TabsTrigger value="male">Male</TabsTrigger>
                <TabsTrigger value="female">Female</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <ScrollArea className="flex-1 px-4 pb-4 pt-2">
          {!loaded ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading voices…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No voices match your search.</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((voice) => {
                const isSelected = voice.id === selectedId;
                const isPlaying = playingId === voice.id;
                const isLoadingPreview = loadingId === voice.id;
                return (
                  <div
                    key={voice.id}
                    className={cn(
                      "focus-ring flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-secondary",
                      isSelected && "bg-primary/10 ring-1 ring-inset ring-primary/30",
                    )}
                    onClick={() => {
                      onSelect(voice);
                      onOpenChange(false);
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(voice.id);
                      }}
                      disabled={isLoadingPreview}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-sm font-semibold text-white transition-transform hover:scale-105"
                    >
                      {isLoadingPreview ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isPlaying ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{voice.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {voice.description || voice.tags.join(", ")}
                      </p>
                    </div>

                    {voice.source === "library" ? (
                      <Badge variant="secondary" className="shrink-0 gap-1">
                        <Library className="h-2.5 w-2.5" /> Library
                      </Badge>
                    ) : (
                      <Badge variant="success" className="shrink-0">
                        Clone
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="flex items-center gap-1.5 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3" /> Click a voice to select it — click the avatar to preview.
        </div>
      </DialogContent>
    </Dialog>
  );
}
