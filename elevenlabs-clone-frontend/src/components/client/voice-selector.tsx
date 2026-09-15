import { useEffect, useRef, useState } from "react";
import { IoChevronDown, IoChevronUp } from "react-icons/io5";
import { useVoiceStore } from "~/stores/voice-store";
import { type ServiceType } from "~/types/services";

export function VoiceSelector({ service }: { service: ServiceType }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getVoices = useVoiceStore((state) => state.getVoices);
  const getSelectedVoice = useVoiceStore((state) => state.getSelectedVoice);
  const selectVoice = useVoiceStore((state) => state.selectVoice);

  const voices = getVoices(service);
  const selectedVoice = getSelectedVoice(service);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between rounded-lg border border-[#23252a] bg-[#141519] px-3 py-2 hover:cursor-pointer hover:border-zinc-700 hover:bg-[#1a1b21] transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-2 w-2 rounded-full bg-zinc-300" />
          <span className="text-xs font-medium text-zinc-200 truncate">
            {selectedVoice?.name ?? "Select Voice"}
          </span>
          {selectedVoice?.isCloned && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
              Custom
            </span>
          )}
        </div>
        {isOpen ? (
          <IoChevronUp className="h-3.5 w-3.5 text-zinc-400" />
        ) : (
          <IoChevronDown className="h-3.5 w-3.5 text-zinc-500" />
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 max-h-80 overflow-auto rounded-lg border border-[#23252a] bg-[#17181d] shadow-xl p-1 flex flex-col gap-0.5">
          <div className="px-2 py-1 text-[10px] font-medium tracking-wider text-zinc-500 uppercase">
            Voice Library ({voices.length})
          </div>
          {voices.map((voice) => (
            <div
              key={voice.id + voice.service}
              className={`flex flex-col px-2.5 py-2 rounded-md hover:cursor-pointer transition-colors ${
                voice.id === selectedVoice?.id
                  ? "bg-[#23252a] text-white font-medium"
                  : "text-zinc-300 hover:bg-white/[0.04] hover:text-white"
              }`}
              onClick={() => {
                selectVoice(service, voice.id);
                setIsOpen(false);
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`h-2 w-2 rounded-full flex-shrink-0 ${
                      voice.id === selectedVoice?.id ? "bg-white" : "bg-zinc-500"
                    }`}
                  />
                  <span className="text-xs truncate font-medium">{voice.name}</span>
                </div>
                {voice.isCloned ? (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                    Custom
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                    Neural
                  </span>
                )}
              </div>
              {voice.description && (
                <span className="text-[11px] text-zinc-500 pl-4 truncate mt-0.5">
                  {voice.description}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

