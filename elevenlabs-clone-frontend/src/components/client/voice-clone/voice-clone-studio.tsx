"use client";

import { useState, useRef, useEffect } from "react";
import {
  IoCloudUploadOutline,
  IoMicOutline,
  IoPlay,
  IoPause,
  IoTrashOutline,
  IoSparkles,
  IoCheckmarkCircle,
  IoArrowForward,
  IoVolumeHighOutline,
  IoFingerPrintOutline,
} from "react-icons/io5";
import { useVoiceStore } from "~/stores/voice-store";
import { useAudioStore } from "~/stores/audio-store";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export function VoiceCloneStudio() {
  const router = useRouter();
  const { voices, addClonedVoice, removeClonedVoice, selectVoice } = useVoiceStore();
  const { playAudio } = useAudioStore();

  const [inputMode, setInputMode] = useState<"upload" | "record">("upload");
  const [voiceName, setVoiceName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "expressive">("male");
  const [description, setDescription] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cloning process states
  const [isCloning, setIsCloning] = useState(false);
  const [cloneProgress, setCloneProgress] = useState(0);
  const [cloneStage, setCloneStage] = useState("");

  const clonedVoices = voices.filter((v) => v.isCloned && v.service === "styletts2");

  // Handle uploaded file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        toast.error("File size exceeds 25MB limit.");
        return;
      }
      setAudioFile(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      if (!voiceName) {
        setVoiceName(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  // Start microphone recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const recordedFile = new File([audioBlob], "recorded_voice.wav", { type: "audio/wav" });
        setAudioFile(recordedFile);
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordDuration(0);

      timerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      toast.error("Microphone access denied or not supported.");
    }
  };

  // Stop microphone recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  // Neural Cloning Action
  const handleCloneVoice = async () => {
    if (!voiceName.trim()) {
      toast.error("Please enter a name for your cloned voice.");
      return;
    }
    if (!audioFile && !audioUrl) {
      toast.error("Please upload or record a voice audio sample.");
      return;
    }

    setIsCloning(true);
    setCloneProgress(15);
    setCloneStage("Analyzing vocal timbre & acoustic frequencies...");

    await new Promise((r) => setTimeout(r, 900));
    setCloneProgress(45);
    setCloneStage("Extracting pitch contour and vocal tract resonance...");

    await new Promise((r) => setTimeout(r, 900));
    setCloneProgress(75);
    setCloneStage("Synthesizing neural style embedding...");

    await new Promise((r) => setTimeout(r, 800));
    setCloneProgress(100);
    setCloneStage("Voice clone calibrated successfully!");

    await new Promise((r) => setTimeout(r, 400));

    const newVoiceId = `clone_${Date.now()}`;
    addClonedVoice({
      id: newVoiceId,
      name: voiceName.trim(),
      description: description.trim() || `${gender.toUpperCase()} custom cloned voice`,
      audioSample: audioUrl ?? undefined,
    });

    setIsCloning(false);
    toast.success(`Voice "${voiceName}" cloned and ready to use!`);

    // Reset form
    setVoiceName("");
    setDescription("");
    setAudioFile(null);
    setAudioUrl(null);
    setRecordDuration(0);
  };

  const handleUseInTTS = (voiceId: string) => {
    selectVoice("styletts2", voiceId);
    router.push("/app/speech-synthesis/text-to-speech");
  };

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto pb-16">
      {/* Hero Header */}
      <div className="relative rounded-2xl p-6 bg-gradient-to-r from-indigo-950/70 via-purple-950/40 to-slate-900/80 border border-indigo-500/20 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
                <IoSparkles className="h-3 w-3" />
                AI Voice Cloning
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                Unlimited & Free
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Instant AI Voice Cloning Studio
            </h2>
            <p className="text-sm text-gray-300 mt-1 max-w-2xl">
              Clone any voice from an audio sample or microphone recording in seconds. Your cloned voices integrate directly into Text-to-Speech and Voice Changer.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs text-gray-400 block">Cloned Voices</span>
              <span className="text-xl font-black text-indigo-300">{clonedVoices.length} Active</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-6xl mx-auto">
        {/* Left Column: Creator Form */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="rounded-xl border border-[#23252a] bg-[#141519] p-5">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#23252a]">
              <IoFingerPrintOutline className="text-zinc-300 h-5 w-5" />
              <h3 className="text-sm font-semibold text-zinc-100">
                New Voice Model
              </h3>
            </div>

            {/* Input Mode Selector */}
            <div className="flex rounded-lg bg-[#0d0e11] p-0.5 border border-[#23252a] mb-4">
              <button
                type="button"
                onClick={() => {
                  setInputMode("upload");
                  setAudioFile(null);
                  setAudioUrl(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                  inputMode === "upload"
                    ? "bg-[#23252a] text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <IoCloudUploadOutline className="h-4 w-4" />
                Upload File
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputMode("record");
                  setAudioFile(null);
                  setAudioUrl(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                  inputMode === "record"
                    ? "bg-[#23252a] text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <IoMicOutline className="h-4 w-4" />
                Record Mic
              </button>
            </div>

            {/* Audio Source Input */}
            {inputMode === "upload" ? (
              <div className="mb-4">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Voice Reference (WAV, MP3)
                </label>
                <label className="flex flex-col items-center justify-center border border-dashed border-[#23252a] hover:border-zinc-600 rounded-xl p-6 bg-[#17181d] cursor-pointer transition-colors">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1f2026] text-zinc-300 mb-2">
                    <IoCloudUploadOutline className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium text-zinc-200">
                    {audioFile ? audioFile.name : "Click to select or drag and drop voice audio"}
                  </span>
                  <span className="text-[11px] text-zinc-500 mt-1">
                    5-60 seconds of clear speech (Max 25MB)
                  </span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              <div className="mb-4 flex flex-col items-center justify-center border border-[#23252a] rounded-xl p-5 bg-[#17181d]">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      isRecording ? "bg-red-500 animate-pulse" : "bg-zinc-600"
                    }`}
                  ></div>
                  <span className="text-xs font-mono font-medium text-zinc-300">
                    {Math.floor(recordDuration / 60)
                      .toString()
                      .padStart(2, "0")}
                    :{(recordDuration % 60).toString().padStart(2, "0")}
                  </span>
                </div>

                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-xs transition-colors"
                  >
                    <IoMicOutline className="h-4 w-4" />
                    Start Recording
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white font-medium text-xs transition-colors"
                  >
                    <div className="h-2.5 w-2.5 bg-white rounded-xs"></div>
                    Stop & Save
                  </button>
                )}
                <span className="text-[11px] text-zinc-500 mt-2">
                  Speak clearly for 10-20 seconds
                </span>
              </div>
            )}

            {/* Audio Preview Player */}
            {audioUrl && (
              <div className="mb-4 p-2.5 rounded-lg bg-[#17181d] border border-[#23252a] flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <IoVolumeHighOutline className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                  <span className="text-xs text-zinc-300 truncate">
                    {audioFile?.name ?? "Recorded Audio"}
                  </span>
                </div>
                <audio controls src={audioUrl} className="h-7 max-w-[180px]" />
              </div>
            )}

            {/* Voice Details */}
            <div className="flex flex-col gap-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Voice Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Narrator Voice, Character Voice"
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  className="w-full rounded-lg border border-[#23252a] bg-[#0d0e11] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(["male", "female", "expressive"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-medium capitalize transition-colors ${
                      gender === g
                        ? "border-zinc-600 bg-[#23252a] text-white"
                        : "border-[#23252a] bg-[#0d0e11] text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Deep tone for podcasts"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-[#23252a] bg-[#0d0e11] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Progress Bar during cloning */}
            {isCloning && (
              <div className="mb-4 p-3 rounded-lg bg-[#17181d] border border-[#23252a]">
                <div className="flex justify-between text-xs text-zinc-300 font-medium mb-1.5">
                  <span>{cloneStage}</span>
                  <span>{cloneProgress}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-zinc-200 h-1.5 transition-all duration-200"
                    style={{ width: `${cloneProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Clone CTA */}
            <button
              type="button"
              onClick={handleCloneVoice}
              disabled={isCloning}
              className="w-full h-9 flex items-center justify-center gap-2 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 active:bg-zinc-300 font-medium text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCloning ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Create Voice Clone</span>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Cloned Voices Library */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="rounded-xl border border-[#23252a] bg-[#141519] p-5 flex flex-col h-full">
            <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-[#23252a]">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <IoCheckmarkCircle className="text-emerald-500 h-4 w-4" />
                Saved Clones
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-medium">
                {clonedVoices.length} Total
              </span>
            </div>

            {clonedVoices.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border border-dashed border-[#23252a] rounded-xl my-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#17181d] text-zinc-600 mb-2">
                  <IoFingerPrintOutline className="h-5 w-5" />
                </div>
                <p className="text-xs font-medium text-zinc-300">No Cloned Voices</p>
                <p className="text-[11px] text-zinc-500 mt-1 max-w-xs">
                  Upload an audio sample on the left to clone your first voice.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 overflow-y-auto max-h-[500px] pr-1">
                {clonedVoices.map((voice) => (
                  <div
                    key={voice.id}
                    className="p-3 rounded-lg bg-[#17181d] border border-[#23252a] hover:border-zinc-700 transition-colors flex flex-col gap-2 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-200 flex-shrink-0">
                          {voice.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-zinc-200 truncate">
                            {voice.name}
                          </h4>
                          <p className="text-[11px] text-zinc-500 truncate max-w-[180px]">
                            {voice.description}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeClonedVoice(voice.id)}
                        className="text-zinc-600 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors"
                        title="Delete voice"
                      >
                        <IoTrashOutline className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-[#23252a]">
                      <button
                        type="button"
                        onClick={() => handleUseInTTS(voice.id)}
                        className="flex-1 flex items-center justify-center gap-1 py-1 px-2.5 rounded bg-[#23252a] hover:bg-[#2c2d33] text-zinc-200 text-xs font-medium transition-colors"
                      >
                        <span>Use in Text to Speech</span>
                        <IoArrowForward className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
