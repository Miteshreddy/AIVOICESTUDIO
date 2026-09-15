"use client";

import { IoDownloadOutline, IoPlay } from "react-icons/io5";
import { type HistoryItem as HistoryItemType } from "~/lib/history";
import { useAudioStore } from "~/stores/audio-store";
import { useVoiceStore, type Voice } from "~/stores/voice-store";
import { type ServiceType } from "~/types/services";

export function HistoryPanel({
  service,
  searchQuery,
  setSearchQuery,
  hoveredItem,
  setHoveredItem,
  historyItems,
}: {
  service: ServiceType;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  hoveredItem: string | null;
  setHoveredItem: (id: string | null) => void;
  historyItems?: HistoryItemType[];
}) {
  const { playAudio } = useAudioStore();
  const getVoices = useVoiceStore((state) => state.getVoices);
  const voices = getVoices(service);

  const handlePlayHistoryItem = (item: HistoryItemType) => {
    if (item.audioUrl) {
      playAudio({
        id: item.id.toString(),
        title: item.title,
        voice: item.voice,
        audioUrl: item.audioUrl,
        service: item.service,
      });
    }
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="w-full flex-shrink-0 mb-3">
        <input
          type="text"
          placeholder="Search history..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-[#23252a] bg-[#0d0e11] px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
        />
      </div>

      {historyItems && historyItems.length > 0 ? (
        <div className="flex h-full w-full flex-col overflow-y-auto pr-1">
          {(() => {
            const filteredGroups = Object.entries(
              historyItems
                .filter(
                  (item) =>
                    item.title
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase()) ||
                    voices
                      .find((voice) => voice.id === item.voice)
                      ?.name.toLowerCase()
                      .includes(searchQuery.toLowerCase()),
                )
                .reduce((groups: Record<string, typeof historyItems>, item) => {
                  const date = item.date;
                  if (!groups[date]) {
                    groups[date] = [];
                  }
                  groups[date].push(item);
                  return groups;
                }, {}),
            );

            return filteredGroups.length > 0 ? (
              filteredGroups.map(([date, items]) => (
                <div key={date} className="mb-3">
                  <div className="sticky top-0 z-10 my-1.5 flex w-full justify-center">
                    <span className="rounded-md bg-[#1c1d22] px-2 py-0.5 text-[10px] font-medium text-zinc-400 border border-[#27272a]">
                      {date}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    {items.map((item) => (
                      <HistoryItem
                        key={item.id}
                        item={item}
                        voices={voices}
                        hoveredItem={hoveredItem}
                        setHoveredItem={setHoveredItem}
                        onPlay={handlePlayHistoryItem}
                      />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="mt-8 text-center text-xs text-zinc-500">
                No matching history found
              </p>
            );
          })()}
        </div>
      ) : (
        <div className="flex h-36 flex-col items-center justify-center text-center">
          <p className="text-xs text-zinc-500">No generation history</p>
        </div>
      )}
    </div>
  );
}

function HistoryItem({
  item,
  voices,
  hoveredItem,
  setHoveredItem,
  onPlay,
}: {
  item: HistoryItemType;
  voices: Voice[];
  hoveredItem: string | null;
  setHoveredItem: (id: string | null) => void;
  onPlay: (item: HistoryItemType) => void;
}) {
  const voiceUsed =
    voices.find((voice) => voice.id === item.voice) ?? voices[0] ?? {
      name: item.voice || "Voice",
      gradientColors: "#71717a",
    };

  return (
    <div
      onMouseEnter={() => setHoveredItem(item.id)}
      onMouseLeave={() => setHoveredItem(null)}
      className="relative flex items-center rounded-lg p-2.5 border border-[#23252a] bg-[#17181d] hover:bg-[#1c1d22] hover:border-zinc-700 transition-colors"
    >
      <div className="flex w-full flex-col gap-1">
        <div className="relative w-full pr-12">
          <p className="truncate text-xs font-medium text-zinc-200">
            {item.title || "Untitled Audio"}
          </p>
          {hoveredItem === item.id && (
            <div className="absolute right-0 top-0 flex items-center gap-0.5 bg-[#23252a] rounded-md px-1 py-0.5 shadow">
              <button
                onClick={() => onPlay(item)}
                className="rounded p-1 text-zinc-200 hover:text-white hover:bg-white/10 transition-colors"
                title="Play"
              >
                <IoPlay className="h-3 w-3" />
              </button>
              <button
                onClick={() => {
                  if (item.audioUrl) {
                    const a = document.createElement("a");
                    a.href = item.audioUrl;
                    a.download = `${item.title || "speech"}.wav`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }
                }}
                className="rounded p-1 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Download"
              >
                <IoDownloadOutline className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-1.5 text-[11px] text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
          <span className="truncate max-w-[120px]">{voiceUsed.name}</span>
          <span className="text-zinc-600">·</span>
          <span className="font-mono text-zinc-400">{item.time || "now"}</span>
        </div>
      </div>
    </div>
  );
}

