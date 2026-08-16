import { useEffect, useMemo, useState } from "react";
import { Search, CheckCircle2, FolderKanban } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VirtualizedList } from "@/components/shared/VirtualizedList";
import { ProjectRow } from "./components/ProjectRow";
import { useProjectsStore } from "./store/projects-store";

const VIRTUALIZE_THRESHOLD = 20;

type FilterTab = "all" | "recent" | "favorites" | "archived";

export default function ProjectsPage() {
  const { generations, loaded, refresh, toggleFavorite, duplicate, archive, unarchive, remove } =
    useProjectsStore();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");

  useEffect(() => {
    if (!loaded) refresh();
  }, [loaded, refresh]);

  const filtered = useMemo(() => {
    let result = generations;
    if (tab === "favorites") result = result.filter((g) => g.favorite);
    else if (tab === "archived") result = result.filter((g) => g.status === "archived");
    else if (tab === "recent")
      result = [...result]
        .filter((g) => g.status !== "archived")
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5);
    else result = result.filter((g) => g.status !== "archived");

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (g) => g.text.toLowerCase().includes(q) || g.voiceName.toLowerCase().includes(q),
      );
    }
    return result;
  }, [generations, tab, search]);

  return (
    <div className="container max-w-4xl space-y-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">{generations.length} total</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5" /> All changes saved
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="recent">Recent</TabsTrigger>
            <TabsTrigger value="favorites">Favorites</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by text or voice…"
            className="pl-9"
          />
        </div>
      </div>

      {!loaded ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-24 text-center">
          <p className="text-sm text-muted-foreground">Loading projects…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-24 text-center">
          <FolderKanban className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No projects here yet</p>
          <p className="text-xs text-muted-foreground">Generate some speech to see it show up here.</p>
        </div>
      ) : filtered.length > VIRTUALIZE_THRESHOLD ? (
        <VirtualizedList
          items={filtered}
          itemKey={(generation) => generation.id}
          estimateSize={68}
          renderItem={(generation) => (
            <ProjectRow
              generation={generation}
              onToggleFavorite={toggleFavorite}
              onDuplicate={duplicate}
              onArchive={archive}
              onUnarchive={unarchive}
              onDelete={remove}
            />
          )}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((generation) => (
            <ProjectRow
              key={generation.id}
              generation={generation}
              onToggleFavorite={toggleFavorite}
              onDuplicate={duplicate}
              onArchive={archive}
              onUnarchive={unarchive}
              onDelete={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
