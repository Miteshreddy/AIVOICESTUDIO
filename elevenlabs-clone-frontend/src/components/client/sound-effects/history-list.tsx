"use client";

import {
  IoDownloadOutline,
  IoPlayOutline,
  IoVolumeHighOutline,
} from "react-icons/io5";
import { type HistoryItem } from "~/lib/history";
import { useAudioStore } from "~/stores/audio-store";

export function HistoryList({ historyItems }: { historyItems: HistoryItem[] }) {
  const { playAudio } = useAudioStore();

  const groupedItems = historyItems.reduce(
    (groups: Record<string, typeof historyItems>, item) => {
      const date = item.date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(item);
      return groups;
    },
    {},
  );

  return (
    <div className="relative flex h-full w-full flex-col items-center">
      <div className="relative z-10 flex h-full w-full flex-col items-center md:pt-4">
        <div className="w-full max-w-3xl rounded-xl border border-[#23252a] bg-[#141519] p-5">
          <div className="mb-4 flex items-center justify-between pb-3 border-b border-[#23252a]">
            <h2 className="text-sm font-semibold text-zinc-100">Sound Effects History</h2>
            <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-medium">
              {historyItems.length} Total
            </span>
          </div>

          {historyItems.length > 0 ? (
            <div className="mt-3">
              {Object.entries(groupedItems).map(([date, items]) => (
                <div key={date} className="mb-4">
                  <div className="mb-2">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                      {date}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-[#23252a] bg-[#17181d] hover:bg-[#1c1d22] hover:border-zinc-700 p-3 transition-colors"
                      >
                        <div className="flex min-w-0 flex-1 items-center">
                          <div className="mr-3 flex-shrink-0 p-1.5 rounded-md bg-[#23252a] text-zinc-300">
                            <IoVolumeHighOutline className="h-3.5 w-3.5" />
                          </div>
                          <p className="text-xs font-medium text-zinc-200 truncate">
                            {item.title}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-zinc-500 font-mono">
                            {item.time}
                          </span>

                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                if (item.audioUrl) {
                                  playAudio({
                                    id: item.id.toString(),
                                    title: item.title,
                                    voice: item.voice || "",
                                    audioUrl: item.audioUrl,
                                    service: item.service,
                                  });
                                }
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-md bg-[#23252a] hover:bg-[#2c2d33] text-zinc-200 hover:text-white transition-colors"
                              title="Play"
                            >
                              <IoPlayOutline className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (item.audioUrl) {
                                  const a = document.createElement("a");
                                  a.href = item.audioUrl;
                                  a.download = `${item.title || "sound-effect"}.wav`;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                }
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#23252a] bg-[#17181d] hover:bg-[#23252a] text-zinc-400 hover:text-white transition-colors"
                              title="Download"
                            >
                              <IoDownloadOutline className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-36 flex-col items-center justify-center text-center">
              <p className="text-xs text-zinc-500">No sound effects generated yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
