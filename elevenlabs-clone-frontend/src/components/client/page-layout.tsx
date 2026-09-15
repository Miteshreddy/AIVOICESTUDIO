"use client";

import { type ReactNode, useEffect } from "react";
import { type ServiceType } from "~/types/services";
import Sidebar from "./sidebar";
import { useUIStore } from "~/stores/ui-store";
import { IoClose, IoMenu } from "react-icons/io5";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SpeechSidebar } from "./speech-synthesis/right-sidebar";
import { type HistoryItem } from "~/lib/history";
import Playbar from "./playbar";
import { useAudioStore } from "~/stores/audio-store";
import { MobileSettingsButton } from "./speech-synthesis/mobile-settings-button";

interface TabItem {
  name: string;
  path: string;
}

export function PageLayout({
  title,
  children,
  service,
  tabs,
  showSidebar = true,
  historyItems,
}: {
  title: string;
  children: ReactNode;
  service: ServiceType;
  tabs?: TabItem[];
  showSidebar: boolean;
  historyItems?: HistoryItem[];
}) {
  const pathname = usePathname();
  const {
    isMobileDrawerOpen,
    isMobileScreen,
    toggleMobileDrawer,
    setMobileScreen,
    toggleMobileMenu,
  } = useUIStore();
  const { currentAudio } = useAudioStore();

  useEffect(() => {
    const checkScreenSize = () => {
      setMobileScreen(window.innerWidth < 1024);
    };
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, [setMobileScreen]);

  return (
    <div className="flex h-screen bg-[#0d0e11] text-zinc-100 overflow-hidden font-sans">
      <div className="hidden lg:block h-full">
        <Sidebar />
      </div>

      {isMobileScreen && isMobileDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={toggleMobileDrawer}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-out lg:hidden ${
          isMobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative h-full w-64 bg-[#141519] border-r border-[#23252a] shadow-xl">
          <button
            onClick={toggleMobileDrawer}
            className="absolute right-3 top-3.5 rounded-md p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <IoClose className="h-5 w-5" />
          </button>
          <Sidebar isMobile={true} />
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="border-b border-[#23252a] bg-[#141519]">
          <div className="flex h-14 items-center justify-between px-6">
            <div className="flex items-center">
              {isMobileScreen && (
                <button
                  onClick={toggleMobileDrawer}
                  className="mr-3 rounded-md p-1.5 hover:bg-white/5 text-zinc-400 hover:text-white lg:hidden transition-colors"
                >
                  <IoMenu className="h-5 w-5" />
                </button>
              )}
              <h1 className="text-sm font-semibold text-zinc-100 tracking-tight">
                {title}
              </h1>

              {tabs && tabs.length > 0 && (
                <div className="ml-6 flex items-center gap-1 p-0.5 rounded-lg bg-[#0d0e11] border border-[#23252a]">
                  {tabs.map((tab) => (
                    <Link
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                        pathname === tab.path
                          ? "bg-[#23252a] text-white shadow-sm"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02]"
                      }`}
                      key={tab.path}
                      href={tab.path}
                    >
                      {tab.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Status indicator */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="font-medium text-zinc-300">Engine Ready</span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto bg-[#0d0e11]">
          <div className="flex h-full">
            <div className="flex-1 px-6 py-6 overflow-y-auto">
              <div className="flex h-full flex-col max-w-5xl mx-auto">{children}</div>
            </div>

            {showSidebar && service && (
              <SpeechSidebar historyItems={historyItems} service={service} />
            )}
          </div>
        </main>

        {isMobileScreen && !pathname.includes("/app/sound-effects") && (
          <MobileSettingsButton toggleMobileMenu={toggleMobileMenu} />
        )}

        {currentAudio && <Playbar />}
      </div>
    </div>
  );
}

