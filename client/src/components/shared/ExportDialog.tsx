import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { processAudio } from "@/services/audio-processing-service";
import { ApiError } from "@/services/api-client";

// Only WAV is offered — it's what we can genuinely produce without adding a
// lossy encoder to the stack. Normalize/trim-silence are real DSP operations
// run through the same backend as Audio Cleanup, not cosmetic toggles.
export function ExportDialog({
  open,
  onOpenChange,
  title,
  audioUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  audioUrl: string;
}) {
  const [normalize, setNormalize] = useState(true);
  const [trimSilence, setTrimSilence] = useState(false);
  const [metadataTitle, setMetadataTitle] = useState(title);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const sourceBlob = await fetch(audioUrl).then((r) => r.blob());
      const filename = `${metadataTitle.trim() || "export"}.wav`;

      let finalUrl = audioUrl;
      if (normalize || trimSilence) {
        const file = new File([sourceBlob], filename, { type: "audio/wav" });
        finalUrl = await processAudio(file, {
          noiseRemoval: { enabled: false, amount: 0 },
          echoRemoval: { enabled: false, amount: 0 },
          normalize: { enabled: normalize, amount: 70 },
          silenceRemoval: { enabled: trimSilence, amount: 60 },
          volumeLeveling: { enabled: false, amount: 0 },
          aiEnhancement: { enabled: false, amount: 0 },
          compressor: { enabled: false, amount: 0 },
          limiter: { enabled: false, amount: 0 },
          eqPreset: "flat",
        });
      }

      const a = document.createElement("a");
      a.href = finalUrl;
      a.download = filename;
      a.click();

      toast.success(`Exported "${metadataTitle}"`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export audio</DialogTitle>
          <DialogDescription>Downloads the real audio as a WAV file.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">File name</Label>
            <Input value={metadataTitle} onChange={(e) => setMetadataTitle(e.target.value)} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <Label className="text-sm font-normal">Normalize loudness</Label>
            <Switch checked={normalize} onCheckedChange={setNormalize} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <Label className="text-sm font-normal">Trim silence</Label>
            <Switch checked={trimSilence} onCheckedChange={setTrimSilence} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="brand" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
