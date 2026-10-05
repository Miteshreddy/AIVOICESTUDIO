import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ArrowRight, FileAudio, Loader2, Mic, Square, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { VoicePicker } from "@/components/studio/VoicePicker";
import { VoiceOrb } from "@/components/studio/VoiceOrb";
import { useElapsedSeconds } from "@/hooks/useElapsedSeconds";
import { convertVoice, type RemoteVoiceSummary } from "@/services/tts-service";
import { ApiError } from "@/services/api-client";
import { useNowPlayingStore } from "@/store/now-playing-store";
import { useGenerationsStore } from "@/store/generations-store";
import { cn } from "@/lib/utils";

export default function VoiceChangerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [voice, setVoice] = useState<RemoteVoiceSummary | null>(null);
  const [removeNoise, setRemoveNoise] = useState(false);
  const [recording, setRecording] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const recSeconds = useElapsedSeconds(recording);
  const elapsed = useElapsedSeconds(startedAt);
  const openPlayer = useNowPlayingStore((s) => s.open);
  const onVoice = useCallback((v: RemoteVoiceSummary) => setVoice(v), []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "audio/*": [], "video/mp4": [], "video/webm": [] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    onDrop: (accepted) => accepted[0] && setFile(accepted[0]),
  });

  async function toggleRecording() {
    if (recording) return recorder.current?.stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(null);
        setFile(new File([new Blob(chunks, { type: rec.mimeType })], "recording.webm", { type: rec.mimeType }));
      };
      recorder.current = rec;
      rec.start();
      setRecording(Date.now());
    } catch {
      toast.error("Microphone access was denied.");
    }
  }

  async function convert() {
    if (!file || !voice || startedAt) return;
    setStartedAt(Date.now());
    try {
      const url = await convertVoice(file, voice.id, removeNoise);
      void useGenerationsStore.getState().refresh();
      openPlayer({
        id: `vc:${Date.now()}`,
        title: `${file.name} → ${voice.name}`,
        subtitle: "Voice changer",
        url,
        orbSeed: voice.id,
        downloadName: `${voice.name}-voice-changer.wav`,
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Conversion failed — is the engine running?");
    } finally {
      setStartedAt(null);
    }
  }

  const ready = !!file && !!voice && !startedAt;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 lg:py-10">
      <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Voice Changer</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your words, timing and emotion — in a different voice.
      </p>

      <div className="mt-8 grid grid-cols-1 items-stretch gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="studio-surface flex min-w-0 flex-col p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Your recording</p>
          {file ? (
            <div className="mt-3 flex flex-1 items-center gap-3 rounded-xl bg-secondary/50 px-3 py-3">
              <FileAudio className="h-5 w-5 text-muted-foreground" />
              <span className="flex-1 truncate text-sm">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground" aria-label="Remove">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={cn(
                "mt-3 flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-3 py-6 text-center transition",
                isDragActive ? "border-primary bg-primary/5" : "hover:bg-secondary/40",
              )}
            >
              <input {...getInputProps()} />
              <Upload className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm">Drop audio or video</p>
            </div>
          )}
          <button
            type="button"
            onClick={toggleRecording}
            className={cn(
              "mt-3 flex h-10 items-center justify-center gap-2 rounded-full text-sm font-medium transition",
              recording ? "bg-destructive text-destructive-foreground" : "bg-secondary hover:bg-secondary/70",
            )}
          >
            {recording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            {recording ? `Stop · ${recSeconds}s` : "Record"}
          </button>
        </div>

        <div className="hidden items-center md:flex">
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="studio-surface flex min-w-0 flex-col p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">New voice</p>
          <div className="mt-3 flex flex-1 flex-col items-center justify-center gap-3 py-2">
            <VoiceOrb seed={voice?.id ?? "none"} size={64} active={!!startedAt} />
          </div>
          <VoicePicker value={voice?.id ?? null} onChange={onVoice} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={removeNoise}
            onChange={(e) => setRemoveNoise(e.target.checked)}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          Clean background noise first
        </label>
        <button
          type="button"
          onClick={convert}
          disabled={!ready}
          className={cn(
            "flex h-11 items-center gap-2 rounded-full px-6 text-sm font-medium transition",
            ready ? "bg-foreground text-background hover:opacity-90" : "cursor-not-allowed bg-secondary text-muted-foreground",
          )}
        >
          {startedAt ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Converting · {elapsed}s
            </>
          ) : (
            "Change voice"
          )}
        </button>
      </div>
    </div>
  );
}
