import { useState } from "react";
import { Star, MoreVertical, Copy, Archive, ArchiveRestore, Trash2, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExportDialog } from "@/components/shared/ExportDialog";
import { ProjectStatusBadge } from "./ProjectStatusBadge";
import { cn, formatDuration, formatRelativeTime } from "@/lib/utils";
import { useGenerationsStore } from "@/store/generations-store";
import type { GenerationRecord } from "@/services/tts-service";

interface ProjectRowProps {
  generation: GenerationRecord;
  onToggleFavorite: (id: string) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ProjectRow({
  generation,
  onToggleFavorite,
  onDuplicate,
  onArchive,
  onUnarchive,
  onDelete,
}: ProjectRowProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const getAudioUrl = useGenerationsStore((s) => s.getAudioUrl);

  async function openExport() {
    if (!audioUrl) setAudioUrl(await getAudioUrl(generation.id));
    setExportOpen(true);
  }

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border px-4 py-3 transition-colors hover:bg-secondary/40">
      <button onClick={() => onToggleFavorite(generation.id)} className="shrink-0">
        <Star
          className={cn(
            "h-4 w-4 text-muted-foreground transition-colors",
            generation.favorite && "fill-warning text-warning",
          )}
        />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{generation.text}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {generation.voiceName} · {formatDuration(generation.durationSeconds)} ·{" "}
          {formatRelativeTime(generation.updatedAt)}
        </p>
      </div>

      <div className="hidden sm:flex">
        <Badge variant="secondary" className="font-normal">
          {generation.voiceName}
        </Badge>
      </div>

      <ProjectStatusBadge status={generation.status} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={openExport}>
            <Download /> Export
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onDuplicate(generation.id)}>
            <Copy /> Regenerate copy
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {generation.status === "archived" ? (
            <DropdownMenuItem onSelect={() => onUnarchive(generation.id)}>
              <ArchiveRestore /> Unarchive
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => onArchive(generation.id)}>
              <Archive /> Archive
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => onDelete(generation.id)}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {audioUrl && (
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          title={generation.text.slice(0, 60)}
          audioUrl={audioUrl}
        />
      )}
    </div>
  );
}
