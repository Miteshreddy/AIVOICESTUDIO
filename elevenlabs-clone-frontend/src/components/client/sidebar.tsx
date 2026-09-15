"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import {
  IoChatboxOutline,
  IoFingerPrintOutline,
  IoMicOutline,
  IoMusicalNotesOutline,
  IoRadioOutline,
} from "react-icons/io5";

export default function Sidebar({ _isMobile = false }: { isMobile?: boolean; _isMobile?: boolean }) {
  const pathname = usePathname();
  const [isExpanded] = useState(true);

  return (
    <aside
      className={`${
        isExpanded ? "w-60" : "w-16"
      } flex h-full flex-col border-r border-[#23252a] bg-[#141519] px-3 py-4 transition-all duration-200 select-none`}
    >
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 px-2 pb-3.5 border-b border-[#23252a]">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900 font-bold text-xs tracking-wider">
          KZ
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-zinc-100 tracking-tight truncate">
            Kaiz Studio
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-4 flex flex-1 flex-col gap-1">
        <div className="px-2 pb-1.5 pt-1">
          <span className="text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
            Audio Tools
          </span>
        </div>

        <SidebarButton
          icon={<IoChatboxOutline />}
          isActive={pathname.includes("/app/speech-synthesis/text-to-speech")}
          href="/app/speech-synthesis/text-to-speech"
        >
          Text to Speech
        </SidebarButton>

        <SidebarButton
          icon={<IoMicOutline />}
          isActive={pathname.includes("/app/speech-synthesis/speech-to-speech")}
          href="/app/speech-synthesis/speech-to-speech"
        >
          Voice Changer
        </SidebarButton>

        <SidebarButton
          icon={<IoMusicalNotesOutline />}
          isActive={pathname.includes("/app/sound-effects")}
          href="/app/sound-effects/generate"
        >
          Sound Effects
        </SidebarButton>

        <SidebarButton
          icon={<IoFingerPrintOutline />}
          isActive={pathname.includes("/app/voice-clone")}
          href="/app/voice-clone"
        >
          Voice Clone
        </SidebarButton>
      </nav>

      {/* Bottom Status */}
      <div className="pt-3 border-t border-[#23252a] px-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <IoRadioOutline className="h-4 w-4 text-zinc-300" />
            <span className="text-zinc-300 font-medium">Local Mode</span>
          </div>
          <span className="text-[11px] text-zinc-400">v1.0</span>
        </div>
      </div>
    </aside>
  );
}

function SidebarButton({
  icon,
  children,
  isActive,
  href,
}: {
  icon: ReactNode;
  children: ReactNode;
  isActive: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`group flex w-full items-center rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
        isActive
          ? "bg-[#23252a] text-white"
          : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
      }`}
    >
      <div
        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center text-base mr-2.5 transition-colors ${
          isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-300"
        }`}
      >
        {icon}
      </div>
      <span className="truncate">{children}</span>
    </Link>
  );
}

