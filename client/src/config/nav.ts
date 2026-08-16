import {
  LayoutDashboard,
  Mic2,
  FolderKanban,
  Library,
  Copy,
  AudioLines,
  Sparkles,
  Settings,
  UserCircle,
  Waves,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const primaryNav: NavItem[] = [
  { label: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { label: "Voice Studio", href: "/app/voice-studio", icon: Mic2 },
  { label: "Projects", href: "/app/projects", icon: FolderKanban },
  { label: "Voice Library", href: "/app/voice-library", icon: Library },
  { label: "Clone Voice", href: "/app/voice-clone", icon: Copy },
  { label: "Generate Speech", href: "/app/generate-speech", icon: Sparkles },
  { label: "Audio Cleanup", href: "/app/audio-cleanup", icon: AudioLines },
  { label: "Audio Editor", href: "/app/audio-editor", icon: Waves },
];

export const secondaryNav: NavItem[] = [
  { label: "Settings", href: "/app/settings", icon: Settings },
  { label: "Account", href: "/app/account", icon: UserCircle },
];
