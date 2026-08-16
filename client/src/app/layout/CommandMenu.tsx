import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Mic2,
  FolderKanban,
  Library,
  Copy,
  AudioLines,
  Sparkles,
  Settings,
  Plus,
  Moon,
  Sun,
  Waves,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useUiStore } from "@/store/ui-store";

export function CommandMenu() {
  const { commandMenuOpen, setCommandMenuOpen, toggleTheme } = useUiStore();
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandMenuOpen(!commandMenuOpen);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [commandMenuOpen, setCommandMenuOpen]);

  function go(path: string) {
    navigate(path);
    setCommandMenuOpen(false);
  }

  return (
    <CommandDialog open={commandMenuOpen} onOpenChange={setCommandMenuOpen}>
      <CommandInput placeholder="Search voices, projects, actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/app/dashboard")}>
            <LayoutDashboard /> Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/app/voice-studio")}>
            <Mic2 /> Voice Studio
          </CommandItem>
          <CommandItem onSelect={() => go("/app/projects")}>
            <FolderKanban /> Projects
          </CommandItem>
          <CommandItem onSelect={() => go("/app/voice-library")}>
            <Library /> Voice Library
          </CommandItem>
          <CommandItem onSelect={() => go("/app/voice-clone")}>
            <Copy /> Clone Voice
          </CommandItem>
          <CommandItem onSelect={() => go("/app/generate-speech")}>
            <Sparkles /> Generate Speech
          </CommandItem>
          <CommandItem onSelect={() => go("/app/audio-cleanup")}>
            <AudioLines /> Audio Cleanup
          </CommandItem>
          <CommandItem onSelect={() => go("/app/audio-editor")}>
            <Waves /> Audio Editor
          </CommandItem>
          <CommandItem onSelect={() => go("/app/settings")}>
            <Settings /> Settings
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/app/generate-speech")}>
            <Plus /> New generation
            <CommandShortcut>⌘G</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("/app/voice-clone")}>
            <Plus /> Clone a new voice
          </CommandItem>
          <CommandItem
            onSelect={() => {
              toggleTheme();
              setCommandMenuOpen(false);
            }}
          >
            <Sun className="dark:hidden" />
            <Moon className="hidden dark:block" />
            Toggle theme
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
