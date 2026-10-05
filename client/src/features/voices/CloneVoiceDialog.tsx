import { useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileAudio, Loader2, Mic, Square, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cloneVoiceRequest, type ClonedVoice } from "@/services/tts-service";
import { ApiError } from "@/services/api-client";
import { useRealVoicesStore } from "@/store/real-voices-store";
import { useElapsedSeconds } from "@/hooks/useElapsedSeconds";
import { VoiceOrb } from "@/components/studio/VoiceOrb";
import { cn } from "@/lib/utils";

const READ_ALOUD =
  "Honestly, I didn't expect today to go like this. I woke up late, spilled my coffee, and missed the bus — " +
  "but then a stranger held the door, smiled, and said, \"Rough morning?\" And somehow, that changed everything. " +
  "Isn't it funny how the smallest moments end up being the ones you remember?";

export function CloneVoiceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (voice: ClonedVoice) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const recSeconds = useElapsedSeconds(recording);
  const elapsed = useElapsedSeconds(startedAt);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setName("");
      setConsent(false);
      recorder.current?.stop();
    }
  }, [open]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "audio/*": [], "video/mp4": [], "video/webm": [] },
    maxSize: 25 * 1024 * 1024,
    onDrop: (accepted) => setFiles((f) => [...f, ...accepted].slice(0, 10)),
    onDropRejected: () => toast.error("Audio files up to 25 MB each."),
  });

  async function toggleRecording() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true },
      });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(null);
        const blob = new Blob(chunks, { type: rec.mimeType });
        if (blob.size > 0)
          setFiles((f) => [...f, new File([blob], `recording-${f.length + 1}.webm`, { type: rec.mimeType })]);
      };
      recorder.current = rec;
      rec.start();
      setRecording(Date.now());
    } catch {
      toast.error("Microphone access was denied.");
    }
  }

  const ready = files.length > 0 && name.trim().length > 0 && consent && !startedAt && !recording;

  async function create() {
    if (!ready) return;
    setStartedAt(Date.now());
    try {
      const voice = await cloneVoiceRequest(name.trim(), "", files);
      useRealVoicesStore.getState().addVoice(voice);
      voice.warnings?.forEach((w) => toast.message(w));
      toast.success(`${voice.name} is ready.`);
      onCreated(voice);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Cloning failed — is the engine running?");
    } finally {
      setStartedAt(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !startedAt && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Clone a voice</DialogTitle>
          <DialogDescription>
            30–90 seconds of one person talking naturally, in a quiet room, gives the most lifelike result.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            {...getRootProps()}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-7 text-center transition",
              isDragActive ? "border-primary bg-primary/5" : "hover:bg-secondary/40",
            )}
          >
            <input {...getInputProps()} />
            <Upload className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm">Drop audio files here, or click to browse</p>
            <p className="text-xs text-muted-foreground">MP3, WAV, M4A, FLAC, WebM · up to 10 files</p>
          </div>

          <div className="rounded-2xl border border-border/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Or record yourself</p>
                <p className="text-xs text-muted-foreground">Read the passage below, naturally.</p>
              </div>
              <button
                type="button"
                onClick={toggleRecording}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition",
                  recording ? "bg-destructive text-destructive-foreground" : "bg-secondary hover:bg-secondary/70",
                )}
              >
                {recording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                {recording ? `Stop · ${recSeconds}s` : "Record"}
              </button>
            </div>
            <p className="mt-3 rounded-xl bg-secondary/50 p-3 text-sm leading-relaxed text-muted-foreground">{READ_ALOUD}</p>
          </div>

          {files.length > 0 && (
            <ul className="space-y-1.5">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-xl bg-secondary/50 px-3 py-2 text-sm">
                  <FileAudio className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button
                    type="button"
                    onClick={() => setFiles((all) => all.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${f.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-3">
            <VoiceOrb seed={name || "new"} size={40} />
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 40))}
              placeholder="Name this voice"
              className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
            />
            This is my voice, or I have the speaker's permission to clone it.
          </label>

          <button
            type="button"
            onClick={create}
            disabled={!ready}
            className={cn(
              "flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-medium transition",
              ready ? "bg-foreground text-background hover:opacity-90" : "cursor-not-allowed bg-secondary text-muted-foreground",
            )}
          >
            {startedAt ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Listening for the clearest speech · {elapsed}s
              </>
            ) : (
              "Create voice"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
