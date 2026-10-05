import { NavLink, Outlet } from "react-router-dom";
import { AudioLines, History, Moon, Music, Repeat, Sun, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEngineStatus } from "@/hooks/useEngineStatus";
import { useUiStore } from "@/store/ui-store";
import { PlayerBar } from "@/components/studio/PlayerBar";

const NAV = [
  { to: "/", label: "Speech", icon: AudioLines, end: true },
  { to: "/voices", label: "Voices", icon: Users },
  { to: "/voice-changer", label: "Voice Changer", icon: Repeat },
  { to: "/sound-effects", label: "Sound Effects", icon: Music },
  { to: "/history", label: "History", icon: History },
];

function EngineDot() {
  const { reachable, ready, checked } = useEngineStatus();
  const state = !checked ? "checking" : !reachable ? "offline" : ready ? "ready" : "warming";
  const label = {
    checking: "Connecting…",
    offline: "Engine offline",
    warming: "Warming up…",
    ready: "Engine ready",
  }[state];
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground" title={label}>
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          state === "ready" && "bg-success",
          state === "warming" && "animate-pulse bg-warning",
          state === "offline" && "bg-destructive",
          state === "checking" && "bg-muted-foreground",
        )}
      />
      <span className="hidden lg:inline">{label}</span>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="bg-gradient-brand grid h-8 w-8 place-items-center rounded-xl shadow-sm">
        <AudioLines className="h-4 w-4 text-white" />
      </span>
      <span className="font-heading text-[15px] font-semibold tracking-tight">KAIZ</span>
    </div>
  );
}

export function AppLayout() {
  const { theme, toggleTheme } = useUiStore();

  return (
    <div className="ambient-glow flex h-screen flex-col overflow-hidden bg-background md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border/60 px-3 py-5 md:flex">
        <div className="px-2">
          <Brand />
        </div>
        <nav className="mt-8 flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                  isActive
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center justify-between px-2">
          <EngineDot />
          <button
            type="button"
            onClick={toggleTheme}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-3 md:hidden">
        <Brand />
        <EngineDot />
      </header>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
        <PlayerBar />
        {/* Mobile tab bar */}
        <nav className="flex justify-around border-t border-border/60 bg-card/80 py-1.5 backdrop-blur md:hidden">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px]",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )
              }
            >
              <Icon className="h-5 w-5" />
              {label.split(" ")[0]}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
