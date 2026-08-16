import { Loader2, WifiOff } from "lucide-react";
import { useEngineStatus } from "@/hooks/useEngineStatus";

export function EngineStatusBanner() {
  const { reachable, ready, checked } = useEngineStatus();

  if (!checked || ready) return null;

  if (!reachable) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        Can't reach the local voice engine. Start it with{" "}
        <code className="rounded bg-destructive/10 px-1 py-0.5 font-mono">
          cd ml-service &amp;&amp; python -m app.main
        </code>
        , or use the desktop shortcut.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
      Voice engine is warming up on your GPU — the first generation can take up to a minute.
    </div>
  );
}
