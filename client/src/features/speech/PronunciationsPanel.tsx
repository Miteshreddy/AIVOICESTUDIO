import { useEffect, useState } from "react";
import { BookA, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getPronunciations, savePronunciations } from "@/services/tts-service";
import { ApiError } from "@/services/api-client";

type Row = { word: string; say: string };

/** Words the narrator should say a particular way, applied to every generation. */
export function PronunciationsPanel() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPronunciations()
      .then((entries) => {
        setRows(Object.entries(entries).map(([word, say]) => ({ word, say })));
        setCount(Object.keys(entries).length);
      })
      .catch(() => undefined);
  }, [open]);

  async function save() {
    setSaving(true);
    try {
      const entries = Object.fromEntries(
        rows.filter((r) => r.word.trim() && r.say.trim()).map((r) => [r.word.trim(), r.say.trim()]),
      );
      const saved = await savePronunciations(entries);
      setCount(Object.keys(saved).length);
      toast.success("Pronunciations saved.");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save pronunciations.");
    } finally {
      setSaving(false);
    }
  }

  const update = (i: number, key: keyof Row, value: string) =>
    setRows((all) => all.map((r, j) => (j === i ? { ...r, [key]: value } : r)));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="studio-surface flex w-full items-center justify-between p-4 text-left transition hover:border-border"
      >
        <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <BookA className="h-3.5 w-3.5" /> Pronunciations
        </span>
        <span className="text-xs text-muted-foreground">{count ? `${count} words` : "Add words"}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Pronunciations</DialogTitle>
            <DialogDescription>
              Tell the narrator how to say names and brand words. Write it the way it sounds, e.g. "Nguyen" → "win".
              Numbers, prices, years and acronyms are handled automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={r.word}
                  onChange={(e) => update(i, "word", e.target.value)}
                  placeholder="Word"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
                />
                <span className="text-muted-foreground">→</span>
                <input
                  value={r.say}
                  onChange={(e) => update(i, "say", e.target.value)}
                  placeholder="Say it like"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
                />
                <button
                  type="button"
                  onClick={() => setRows((all) => all.filter((_, j) => j !== i))}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-destructive"
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setRows((all) => [...all, { word: "", say: "" }])}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
            >
              <Plus className="h-4 w-4" /> Add word
            </button>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="mt-2 flex h-11 w-full items-center justify-center rounded-full bg-foreground text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
