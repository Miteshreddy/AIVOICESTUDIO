import { useState } from "react";
import { Link } from "react-router-dom";
import { Play, Pause, Loader2, Trash2, Pencil, Check, X, Download, Plus, Sparkles, Library } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRelativeTime } from "@/lib/utils";
import { downloadVoiceReference } from "@/services/tts-service";
import { ApiError } from "@/services/api-client";
import { useRealVoicesStore } from "@/store/real-voices-store";
import { useVoicePreview } from "@/hooks/useVoicePreview";
import type { RemoteVoiceSummary } from "@/services/tts-service";

export function RealVoiceCard({ voice }: { voice: RemoteVoiceSummary }) {
  const { removeVoice, updateVoice } = useRealVoicesStore();
  const { toggle, loadingId, playingId } = useVoicePreview();
  const loadingPreview = loadingId === voice.id;
  const playing = playingId === voice.id;
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(voice.name);
  const [addingTag, setAddingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState("");

  async function handleDelete() {
    setDeleting(true);
    try {
      await removeVoice(voice.id);
      toast.success(`Deleted "${voice.name}".`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete voice.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const url = await downloadVoiceReference(voice.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${voice.name.replace(/\s+/g, "-").toLowerCase()}-reference.wav`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't download reference sample.");
    } finally {
      setDownloading(false);
    }
  }

  async function saveName() {
    setEditingName(false);
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === voice.name) {
      setNameDraft(voice.name);
      return;
    }
    try {
      await updateVoice(voice.id, { name: trimmed });
    } catch (err) {
      setNameDraft(voice.name);
      toast.error(err instanceof Error ? err.message : "Couldn't rename voice.");
    }
  }

  async function addTag() {
    const trimmed = tagDraft.trim();
    setAddingTag(false);
    setTagDraft("");
    if (!trimmed || voice.tags.includes(trimmed)) return;
    try {
      await updateVoice(voice.id, { tags: [...voice.tags, trimmed] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add tag.");
    }
  }

  async function removeTag(tag: string) {
    try {
      await updateVoice(voice.id, { tags: voice.tags.filter((t) => t !== tag) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove tag.");
    }
  }

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
      <Card className="group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                onClick={() => toggle(voice.id)}
                disabled={loadingPreview}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-base font-semibold text-white transition-transform hover:scale-105"
                title={playing ? "Pause" : "Preview"}
              >
                {loadingPreview ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : playing ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                {editingName ? (
                  <div className="flex items-center gap-1">
                    <Input
                      autoFocus
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveName();
                        if (e.key === "Escape") {
                          setNameDraft(voice.name);
                          setEditingName(false);
                        }
                      }}
                      className="h-7 text-sm"
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={saveName}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <button
                    className="group/name flex items-center gap-1.5"
                    onClick={() => setEditingName(true)}
                  >
                    <p className="truncate font-medium">{voice.name}</p>
                    <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/name:opacity-100" />
                  </button>
                )}
                <p className="truncate text-xs text-muted-foreground">
                  {voice.source === "library" ? "Built-in" : `Cloned ${formatRelativeTime(voice.createdAt)}`}
                  {voice.generationCount > 0 && ` · Used ${voice.generationCount}×`}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>

          {voice.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{voice.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            {voice.source === "library" ? (
              <Badge variant="secondary" className="gap-1">
                <Library className="h-2.5 w-2.5" /> Library
              </Badge>
            ) : (
              <Badge variant="success">Your clone</Badge>
            )}
            {voice.tags.filter((tag) => tag !== "male" && tag !== "female").map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="group/tag cursor-pointer gap-1 pr-1"
                onClick={() => removeTag(tag)}
              >
                {tag}
                <X className="h-2.5 w-2.5 opacity-0 group-hover/tag:opacity-100" />
              </Badge>
            ))}
            {addingTag ? (
              <Input
                autoFocus
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTag();
                  if (e.key === "Escape") {
                    setAddingTag(false);
                    setTagDraft("");
                  }
                }}
                onBlur={addTag}
                placeholder="tag…"
                className="h-5 w-20 px-1.5 py-0 text-xs"
              />
            ) : (
              <button
                onClick={() => setAddingTag(true)}
                className="flex items-center gap-0.5 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
              >
                <Plus className="h-2.5 w-2.5" /> tag
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleDownload}
              disabled={downloading}
              title="Download reference sample"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            </Button>
            <Button asChild variant="brand" size="sm" className="h-8 px-3 text-xs">
              <Link to={`/app/generate-speech?voiceId=${voice.id}`}>
                <Sparkles className="h-3.5 w-3.5" /> Generate
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
