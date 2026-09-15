"use client";

import { useEffect, useState } from "react";
import { FaUpload } from "react-icons/fa";
import {
  generateSpeechToSpeech,
  generateUploadUrl,
  generationStatus,
} from "~/actions/generate-speech";
import { GenerateButton } from "~/components/client/generate-button";
import { useAudioStore } from "~/stores/audio-store";
import { useVoiceStore } from "~/stores/voice-store";
import { type ServiceType } from "~/types/services";

const ALLOWED_AUDIO_TYPES = ["audio/mp3", "audio/wav", "audio/mpeg"];

export function VoiceChanger({
  service,
}: {
  credits?: number;
  service: ServiceType;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);

  const { playAudio } = useAudioStore();
  const getSelectedVoice = useVoiceStore((state) => state.getSelectedVoice);

  const handleFileSelect = (selectedFile: File) => {
    const isAllowedAudio = ALLOWED_AUDIO_TYPES.includes(selectedFile.type) || selectedFile.name.endsWith(".wav") || selectedFile.name.endsWith(".mp3");
    const isUnder50MB = selectedFile.size <= 50 * 1024 * 1024;

    if (isAllowedAudio && isUnder50MB) {
      setFile(selectedFile);
    } else {
      alert(
        isAllowedAudio
          ? "File is too large. Max size is 50MB"
          : "Please select an MP3 or WAV file only",
      );
    }
  };

  const handleGenerateSpeech = async () => {
    const selectedVoice = getSelectedVoice("seedvc");

    if (!file || !selectedVoice) return;

    try {
      setIsLoading(true);

      const { uploadUrl, s3Key } = await generateUploadUrl(file.type || "audio/wav");

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "audio/wav",
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to storage");
      }

      const { audioId } = await generateSpeechToSpeech(
        s3Key,
        selectedVoice.id,
      );

      setCurrentAudioId(audioId);
    } catch (error) {
      console.error("Error generating speech: ", error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!currentAudioId || !isLoading) return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await generationStatus(currentAudioId);
        const selectedVoice = getSelectedVoice("seedvc");

        if (status.success && status.audioUrl && selectedVoice) {
          clearInterval(pollInterval);
          setIsLoading(false);

          const newAudio = {
            id: currentAudioId,
            title: file?.name ?? "Voice changed audio",
            audioUrl: status.audioUrl,
            voice: selectedVoice.id,
            duration: "0:30",
            progress: 0,
            service: service,
            createdAt: new Date().toLocaleDateString(),
          };

          playAudio(newAudio);
          setCurrentAudioId(null);
          setFile(null);
        } else if (!status.success) {
          clearInterval(pollInterval);
          setIsLoading(false);
          setCurrentAudioId(null);
        }
      } catch (error) {
        clearInterval(pollInterval);
        setIsLoading(false);
        setCurrentAudioId(null);
      }
    }, 500);

    return () => {
      clearInterval(pollInterval);
    };
  }, [currentAudioId, isLoading, getSelectedVoice, playAudio, file, service]);

  return (
    <div className="flex flex-1 flex-col justify-between">
      <div className="flex flex-1 items-center justify-center py-4">
        <div
          className={`w-full max-w-lg rounded-xl border border-dashed p-8 transition-colors ${
            isDragging
              ? "border-zinc-400 bg-[#1c1d22]"
              : "border-[#23252a] hover:border-zinc-700 bg-[#141519]"
          }`}
          onDragOver={() => setIsDragging(true)}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            setIsDragging(false);

            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              const file = e.dataTransfer.files[0];
              if (file) {
                handleFileSelect(file);
              }
            }
          }}
          onClick={() => {
            if (isLoading) return;

            const input = document.createElement("input");
            input.type = "file";
            input.accept = "audio/mp3,audio/wav";
            input.onchange = (e) => {
              const target = e.target as HTMLInputElement;
              if (target.files && target.files.length > 0) {
                const file = target.files[0];
                if (file) {
                  handleFileSelect(file);
                }
              }
            };
            input.click();
          }}
        >
          {file ? (
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 rounded-lg border border-[#23252a] bg-[#1a1b21] p-3 text-zinc-300">
                <FaUpload className="h-5 w-5" />
              </div>
              <p className="mb-0.5 text-sm font-medium text-zinc-100 truncate max-w-xs">
                {file.name}
              </p>
              <p className="text-xs text-zinc-500">
                {(file.size / (1024 * 1024)).toFixed(2)} MB · Ready for Conversion
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isLoading) {
                    setFile(null);
                  }
                }}
                disabled={isLoading}
                className={`mt-3 text-xs font-medium px-3 py-1 rounded-md border border-[#23252a] ${
                  isLoading
                    ? "cursor-not-allowed text-zinc-600"
                    : "text-zinc-300 hover:text-white hover:bg-white/5"
                }`}
              >
                Change file
              </button>
            </div>
          ) : (
            <div className="flex cursor-pointer flex-col items-center py-4 text-center">
              <div className="mb-3 rounded-lg border border-[#23252a] bg-[#1a1b21] p-3 text-zinc-400">
                <FaUpload className="h-5 w-5" />
              </div>
              <p className="mb-1 text-xs font-medium text-zinc-200">
                Upload audio or drag and drop
              </p>
              <p className="text-[11px] text-zinc-500">
                MP3 or WAV up to 50MB
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="pt-3">
        <GenerateButton
          onGenerate={handleGenerateSpeech}
          isDisabled={!file || isLoading}
          isLoading={isLoading}
          showDownload={true}
          buttonText="Convert Voice"
        />
      </div>
    </div>
  );
}

