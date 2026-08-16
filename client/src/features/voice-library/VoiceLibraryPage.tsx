import { useEffect, useMemo, useState } from "react";
import { Plus, Library as LibraryIcon, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RealVoiceCard } from "./components/RealVoiceCard";
import { useRealVoicesStore } from "@/store/real-voices-store";

type SourceFilter = "all" | "library" | "user";
type GenderFilter = "all" | "male" | "female";
type SortKey = "recent" | "name" | "used";

export default function VoiceLibraryPage() {
  const { voices, loaded, refresh } = useRealVoicesStore();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("recent");

  useEffect(() => {
    if (!loaded) refresh();
  }, [loaded, refresh]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    voices.forEach((v) => v.tags.forEach((t) => {
      if (t !== "male" && t !== "female") set.add(t);
    }));
    return Array.from(set).sort();
  }, [voices]);

  const filtered = useMemo(() => {
    let result = voices;

    if (sourceFilter !== "all") result = result.filter((v) => v.source === sourceFilter);
    if (genderFilter !== "all") result = result.filter((v) => v.gender === genderFilter);
    if (tagFilter !== "all") result = result.filter((v) => v.tags.includes(tagFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q) ||
          v.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    result = [...result].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "used") return b.generationCount - a.generationCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [voices, search, sourceFilter, genderFilter, tagFilter, sortKey]);

  const libraryCount = voices.filter((v) => v.source === "library").length;
  const userCount = voices.filter((v) => v.source === "user").length;

  return (
    <div className="container max-w-6xl space-y-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Voice Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {voices.length} voices · {libraryCount} built-in · {userCount} cloned by you
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/app/voice-clone">
              <Plus /> Clone a voice
            </Link>
          </Button>
          <Button asChild variant="brand">
            <Link to="/app/voice-studio">
              <Plus /> Create Voice
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search voices by name, tag, or description…"
            className="pl-9"
          />
        </div>

        <Select value={genderFilter} onValueChange={(v) => setGenderFilter(v as GenderFilter)}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="Gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All genders</SelectItem>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
          </SelectContent>
        </Select>

        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {allTags.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most recent</SelectItem>
            <SelectItem value="name">Name (A–Z)</SelectItem>
            <SelectItem value="used">Most used</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
        <TabsList>
          <TabsTrigger value="all">All ({voices.length})</TabsTrigger>
          <TabsTrigger value="library">Library ({libraryCount})</TabsTrigger>
          <TabsTrigger value="user">My Clones ({userCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      {!loaded ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-24 text-center">
          <p className="text-sm text-muted-foreground">Loading voices…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-24 text-center">
          <LibraryIcon className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No voices match your filters</p>
          <p className="text-xs text-muted-foreground">Try adjusting search or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((voice) => (
            <RealVoiceCard key={voice.id} voice={voice} />
          ))}
        </div>
      )}
    </div>
  );
}
