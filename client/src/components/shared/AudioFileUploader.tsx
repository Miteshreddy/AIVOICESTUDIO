import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileAudio, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AudioFileUploader({
  file,
  onFile,
  onClear,
  hint,
}: {
  file: File | null;
  onFile: (file: File) => void;
  onClear: () => void;
  hint?: string;
}) {
  const onDrop = useCallback((accepted: File[]) => accepted[0] && onFile(accepted[0]), [onFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "audio/*": [".mp3", ".wav", ".m4a", ".flac", ".ogg"] },
    multiple: false,
  });

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <FileAudio className="h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "focus-ring flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary/20 px-6 py-12 text-center transition-colors",
        isDragActive && "border-primary bg-primary/5",
      )}
    >
      <input {...getInputProps()} />
      <UploadCloud className="h-6 w-6 text-primary" />
      <p className="text-sm font-medium">
        {isDragActive ? "Drop audio file here" : hint ?? "Drag & drop an audio file, or click to browse"}
      </p>
    </div>
  );
}
