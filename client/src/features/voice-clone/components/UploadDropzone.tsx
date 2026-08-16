import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileAudio, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useVoiceCloneStore } from "../store/voice-clone-store";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadDropzone() {
  const { files, addFiles, removeFile, startAnalysis } = useVoiceCloneStore();

  const onDrop = useCallback(
    (accepted: File[]) => addFiles(accepted),
    [addFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "audio/*": [".mp3", ".wav", ".m4a", ".flac", ".ogg"] },
    multiple: true,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "focus-ring flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-secondary/20 px-6 py-16 text-center transition-colors",
          isDragActive && "border-primary bg-primary/5",
        )}
      >
        <input {...getInputProps()} />
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-brand">
          <UploadCloud className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="font-medium">
            {isDragActive ? "Drop audio files here" : "Drag & drop audio samples"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            or click to browse — MP3, WAV, M4A, FLAC, OGG. 1–5 minutes recommended.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {files.map((file) => (
              <div
                key={file.name}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
              >
                <FileAudio className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => removeFile(file.name)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <Button variant="brand" className="w-full" disabled={files.length === 0} onClick={startAnalysis}>
        Analyze samples
      </Button>
    </div>
  );
}
