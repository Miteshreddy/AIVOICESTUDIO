import { NavLink } from "react-router-dom";
import { ChevronsLeft } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { primaryNav, secondaryNav } from "@/config/nav";
import { useUiStore } from "@/store/ui-store";
import { AnimatedWaveform } from "@/components/shared/AnimatedWaveform";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function NavSection({ items, collapsed }: { items: typeof primaryNav; collapsed: boolean }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const link = (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              cn(
                "focus-ring group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                isActive && "bg-secondary text-foreground",
                collapsed && "justify-center px-2",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="sidebar-active-pill"
                    className="absolute left-0 h-5 w-0.5 rounded-full bg-gradient-brand"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </>
            )}
          </NavLink>
        );

        if (!collapsed) return link;

        return (
          <Tooltip key={item.href} delayDuration={200}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-border bg-card/40 transition-[width] duration-200",
        sidebarCollapsed ? "w-16" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center gap-2 px-4",
          sidebarCollapsed && "justify-center px-0",
        )}
      >
        {sidebarCollapsed ? (
          <div className="h-6 w-6 rounded-md bg-gradient-brand" />
        ) : (
          <>
            <div className="h-6 w-6 shrink-0 rounded-md bg-gradient-brand" />
            <span className="text-sm font-semibold tracking-tight">Voice Studio AI</span>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        <NavSection items={primaryNav} collapsed={sidebarCollapsed} />
        <div className="my-3 h-px bg-border" />
        <NavSection items={secondaryNav} collapsed={sidebarCollapsed} />
      </div>

      {!sidebarCollapsed && (
        <div className="border-t border-border p-3">
          <AnimatedWaveform bars={16} className="h-6 opacity-40" />
        </div>
      )}

      <button
        onClick={toggleSidebar}
        className="focus-ring flex h-10 items-center justify-center border-t border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ChevronsLeft className={cn("h-4 w-4 transition-transform", sidebarCollapsed && "rotate-180")} />
      </button>
    </aside>
  );
}
