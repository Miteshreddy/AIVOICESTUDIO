import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AudioFileUploader } from "@/components/shared/AudioFileUploader";
import { EditorToolbar } from "./components/EditorToolbar";
import { WaveformCanvas } from "./components/WaveformCanvas";
import { VolumeAutomationLane } from "./components/VolumeAutomationLane";
import { MarkersList } from "./components/MarkersList";
import { useAudioEditorStore } from "./store/audio-editor-store";
import { decodeAudioPeaks } from "./lib/decode-audio";
import { useEditorShortcuts } from "./hooks/useEditorShortcuts";

export default function AudioEditorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const { duration, playhead, isPlaying, setIsPlaying, setPlayhead, loadAudio } =
    useAudioEditorStore();

  async function handleFile(selected: File) {
    setLoading(true);
    try {
      const { duration: dur, peaks, audioBuffer } = await decodeAudioPeaks(selected);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = URL.createObjectURL(selected);
      setFile(selected);
      loadAudio(selected.name, dur, peaks, audioBuffer);
    } catch {
      toast.error("Couldn't decode that audio file.");
    } finally {
      setLoading(false);
    }
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  }

  useEditorShortcuts(togglePlay);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Math.abs(audio.currentTime - playhead) > 0.15) {
      audio.currentTime = playhead;
    }
  }, [playhead]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    function onTimeUpdate() {
      setPlayhead(audio!.currentTime);
    }
    function onEnded() {
      setIsPlaying(false);
    }
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [setPlayhead, setIsPlaying]);

  return (
    <div className="container max-w-5xl space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audio Editor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Split, trim, fade, and automate volume on a real waveform timeline.
        </p>
      </div>

      {!file ? (
        <AudioFileUploader
          file={file}
          onFile={handleFile}
          onClear={() => setFile(null)}
          hint={loading ? "Decoding audio…" : "Drag & drop an audio file, or click to browse"}
        />
      ) : (
        <>
          <audio ref={audioRef} src={objectUrlRef.current ?? undefined} />

          <Card className="overflow-hidden">
            <EditorToolbar onTogglePlay={togglePlay} />
            <CardContent className="space-y-1 p-4">
              {duration > 0 ? (
                <>
                  <WaveformCanvas />
                  <VolumeAutomationLane />
                </>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Decoding…</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Markers</CardTitle>
            </CardHeader>
            <CardContent>
              <MarkersList />
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Shortcuts: <kbd className="rounded border border-border px-1">Space</kbd> play/pause ·{" "}
            <kbd className="rounded border border-border px-1">S</kbd> split ·{" "}
            <kbd className="rounded border border-border px-1">T</kbd> trim to selection ·{" "}
            <kbd className="rounded border border-border px-1">⌘Z</kbd> undo ·{" "}
            <kbd className="rounded border border-border px-1">⌘⇧Z</kbd> redo
          </p>
        </>
      )}
    </div>
  );
}
