"use client";

import { useUIStore } from "~/stores/ui-store";
import { type ServiceType } from "~/types/services";
import { VoiceSelector } from "../voice-selector";
import { HistoryPanel } from "./history-panel";
import { useState } from "react";
import { type HistoryItem } from "~/lib/history";
import { IoClose } from "react-icons/io5";

export function SpeechSidebar({
  service,
  historyItems,
}: {
  service: ServiceType;
  historyItems?: HistoryItem[];
}) {
  const {
    activeTab,
    setActiveTab,
    isMobileMenuOpen,
    toggleMobileMenu,
    isMobileScreen,
  } = useUIStore();

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <>
      <aside className="hidden h-full w-[340px] flex-col border-l border-[#23252a] bg-[#141519] p-4 md:flex lg:w-[380px]">
        {/* Tab switcher */}
        <div className="mb-4 flex p-0.5 rounded-lg bg-[#0d0e11] border border-[#23252a]">
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === "settings"
                ? "bg-[#23252a] text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Voice Settings
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === "history"
                ? "bg-[#23252a] text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            History
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === "settings" ? (
            <div className="mb-4">
              <h2 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Voice Selection
              </h2>
              <VoiceSelector service={service} />
              <p className="text-xs text-zinc-500 mt-2">
                Choose a neural voice model for synthesis.
              </p>
            </div>
          ) : (
            <HistoryPanel
              service={service}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              hoveredItem={hoveredItem}
              setHoveredItem={setHoveredItem}
              historyItems={historyItems}
            />
          )}
        </div>
      </aside>

      {/* Mobile menu overlay */}
      {isMobileScreen && isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={toggleMobileMenu}
        />
      )}

      <div
        className={`fixed inset-x-0 bottom-0 z-50 transform transition-transform duration-200 ease-out lg:hidden ${
          isMobileMenuOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="max-h-[80vh] overflow-y-auto rounded-t-xl bg-[#141519] border-t border-[#23252a] p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-end">
            <button
              onClick={toggleMobileMenu}
              className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-white/5"
            >
              <IoClose className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="mb-4 flex p-0.5 rounded-lg bg-[#0d0e11] border border-[#23252a]">
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === "settings"
                  ? "bg-[#23252a] text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Settings
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === "history"
                  ? "bg-[#23252a] text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              History
            </button>
          </div>

          <div>
            {activeTab === "settings" ? (
              <div className="mb-4">
                <h2 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Voice Selection
                </h2>
                <VoiceSelector service={service} />
              </div>
            ) : (
              <HistoryPanel
                service={service}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                hoveredItem={hoveredItem}
                setHoveredItem={setHoveredItem}
                historyItems={historyItems}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

