"use client";

import { useEffect } from "react";
import {
  IoChevronDown,
  IoDownloadOutline,
  IoPause,
  IoPlay,
  IoTimeOutline,
} from "react-icons/io5";
import { RiForward10Fill, RiReplay10Fill } from "react-icons/ri";
import { useAudioStore } from "~/stores/audio-store";
import { useVoiceStore } from "~/stores/voice-store";
import { audioManager } from "~/utils/audio-manager";

export default function Playbar() {
  const {
    currentAudio,
    isPlaybarOpen,
    isPlaying,
    progress,
    duration,
    togglePlaybar,
    togglePlayPause,
    skipForward,
    skipBackward,
    downloadAudio,
    setIsPlaying,
    setProgress,
    setDuration,
  } = useAudioStore();

  const getVoices = useVoiceStore((state) => state.getVoices);

  useEffect(() => {
    if (!currentAudio) return;

    const audio = audioManager.initialize();
    if (!audio) return;

    const handleTimeUpdate = () => {
      const currentProgress = audioManager.getProgress();
      setProgress(currentProgress);
    };

    const handleLoadedMetadata = () => {
      const durationTime = audioManager.getDuration();
      const formattedDuration = formatTime(durationTime);
      setDuration(formattedDuration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [currentAudio, setDuration, setIsPlaying, setProgress]);

  const styleTTS2Voices = getVoices("styletts2");
  const seedVCVoices = getVoices("seedvc");
  const allVoices = [...styleTTS2Voices, ...seedVCVoices];
  const voice = allVoices.find((v) => v.id === currentAudio?.voice);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getCurrentTimeFormatted = () => {
    return formatTime(audioManager.getCurrentTime());
  };

  return (
    <>
      {!isPlaybarOpen && (
        <div
          onClick={togglePlaybar}
          className="absolute bottom-2 left-1/2 z-30 -translate-x-1/2 transform cursor-pointer"
        >
          <div className="flex h-1 w-80 items-center rounded-full bg-zinc-800 overflow-hidden shadow-md">
            <div
              className="h-full rounded-full bg-zinc-300"
              style={{ width: `${progress === 0 ? 100 : progress}%` }}
            />
          </div>
        </div>
      )}

      <div
        className="relative border-t border-[#23252a] bg-[#141519] z-30"
      >
        <div className="absolute left-0 top-0 h-0.5 w-full bg-zinc-800 md:hidden">
          <div
            className="absolute h-0.5 bg-zinc-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div
          className="transition-all duration-200 ease-out"
          style={{
            height: isPlaybarOpen ? "74px" : "0px",
          }}
        >
          <div className="hidden h-full md:grid md:grid-cols-[28%_44%_28%] items-center px-4">
            {/* Left section */}
            <div className="flex items-center">
              <div className="flex flex-col gap-0.5 min-w-0 pr-4">
                <p className="max-w-xs truncate text-xs font-semibold text-zinc-100">
                  {currentAudio?.title}
                </p>
                <div className="flex items-center text-[11px] text-zinc-500">
                  {voice && (
                    <div className="flex items-center mr-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 mr-1.5" />
                      <span className="truncate max-w-[100px] text-zinc-400">
                        {voice.name}
                      </span>
                      <span className="mx-1.5 text-zinc-700">·</span>
                    </div>
                  )}

                  <div className="flex items-center text-zinc-500">
                    <IoTimeOutline className="mr-1 h-3 w-3 text-zinc-400" />
                    <span className="font-mono text-[10px]">
                      {currentAudio?.createdAt ?? "Just now"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Center section */}
            <div className="flex flex-col items-center justify-center">
              <div className="flex items-center space-x-3 mb-1">
                <button
                  onClick={skipBackward}
                  className="rounded-md p-1 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                  title="Rewind 10s"
                >
                  <RiReplay10Fill className="h-4 w-4" />
                </button>
                <button
                  onClick={togglePlayPause}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-zinc-950 hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <IoPause className="h-4 w-4" />
                  ) : (
                    <IoPlay className="ml-0.5 h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={skipForward}
                  className="rounded-md p-1 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                  title="Forward 10s"
                >
                  <RiForward10Fill className="h-4 w-4" />
                </button>
              </div>

              <div className="flex w-full max-w-sm items-center">
                <span className="mr-2 text-[10px] font-mono text-zinc-500">
                  {getCurrentTimeFormatted()}
                </span>
                <div className="relative flex-1">
                  <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-zinc-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <span className="ml-2 text-[10px] font-mono text-zinc-500">
                  {duration}
                </span>
              </div>
            </div>

            {/* Right section */}
            <div className="flex items-center justify-end gap-2 px-2">
              <button
                onClick={downloadAudio}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#23252a] bg-[#17181d] hover:bg-[#1f2026] text-xs font-medium text-zinc-300 hover:text-white transition-colors"
                title="Download Audio"
              >
                <IoDownloadOutline className="h-3.5 w-3.5" />
                <span>Download</span>
              </button>
              <button
                onClick={togglePlaybar}
                className="rounded-md p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                title="Collapse Player"
              >
                <IoChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Mobile view */}
          <div className="flex h-full md:hidden items-center justify-between px-4">
            <div className="flex flex-1 items-center min-w-0 pr-3">
              <div className="flex flex-col gap-0.5 truncate">
                <p className="truncate text-xs font-semibold text-zinc-100">
                  {currentAudio?.title}
                </p>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {getCurrentTimeFormatted()} / {duration}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={downloadAudio}
                className="rounded-md p-1.5 text-zinc-400 hover:text-white hover:bg-white/5"
              >
                <IoDownloadOutline className="h-4 w-4" />
              </button>
              <button
                onClick={togglePlayPause}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-zinc-950"
              >
                {isPlaying ? (
                  <IoPause className="h-3.5 w-3.5" />
                ) : (
                  <IoPlay className="ml-0.5 h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

