"use client";

import { GoDownload } from "react-icons/go";

export function GenerateButton({
  onGenerate,
  isDisabled,
  isLoading,
  showDownload,
  characterCount,
  characterLimit,
  buttonText = "Generate Speech",
  className,
  fullWidth,
  showCharacterCount,
}: {
  onGenerate: () => void;
  isDisabled?: boolean;
  isLoading?: boolean;
  showDownload?: boolean;
  creditsRemaining?: number;
  characterCount?: number;
  characterLimit?: number;
  buttonText?: string;
  className?: string;
  fullWidth?: boolean;
  showCharacterCount?: boolean;
  showCredits?: boolean;
}) {
  return (
    <div
      className={`flex w-full flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between ${className ?? ""}`}
    >
      <div className="flex w-full items-center justify-between sm:w-auto">
        {showCharacterCount &&
          characterCount !== undefined &&
          characterLimit !== undefined && (
            <p className="text-xs text-zinc-500">
              <span className="text-zinc-300 font-medium">{characterCount}</span>
              <span className="text-zinc-600"> / </span>
              <span>{characterLimit}</span> characters
            </p>
          )}
      </div>

      <div
        className={`flex items-center gap-2.5 ${fullWidth ? "w-full" : "w-full sm:w-auto"}`}
      >
        {showDownload && (
          <button
            className="hidden h-9 w-9 items-center justify-center rounded-lg border border-[#23252a] bg-[#141519] text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors sm:flex"
            type="button"
            disabled={true}
          >
            <GoDownload className="h-4 w-4" />
          </button>
        )}

        <button
          className={`h-9 w-full sm:w-auto whitespace-nowrap rounded-lg px-4 text-xs font-semibold transition-colors flex items-center justify-center gap-2 ${
            isDisabled
              ? "cursor-not-allowed bg-zinc-800 text-zinc-500"
              : "bg-white text-zinc-950 hover:bg-zinc-200 active:bg-zinc-300"
          }`}
          onClick={onGenerate}
          disabled={isDisabled ?? isLoading}
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent"></div>
              <span>Synthesizing...</span>
            </div>
          ) : (
            <span>{buttonText}</span>
          )}
        </button>
      </div>
    </div>
  );
}

