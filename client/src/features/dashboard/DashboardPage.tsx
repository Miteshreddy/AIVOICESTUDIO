import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Mic2, Copy, Sparkles, AudioLines, Clock, FolderKanban, Library, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "./components/StatCard";
import { ProjectStatusBadge } from "@/features/projects/components/ProjectStatusBadge";
import { formatDuration, formatRelativeTime } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useRealVoicesStore } from "@/store/real-voices-store";
import { useGenerationsStore } from "@/store/generations-store";

const quickActions = [
  { label: "Create Voice", href: "/app/voice-studio", icon: Mic2 },
  { label: "Clone Voice", href: "/app/voice-clone", icon: Copy },
  { label: "Generate Speech", href: "/app/generate-speech", icon: Sparkles },
  { label: "Clean Audio", href: "/app/audio-cleanup", icon: AudioLines },
];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function DashboardPage() {
  const { user } = useAuthStore();
  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0];
  const { voices, loaded: voicesLoaded, refresh: refreshVoices } = useRealVoicesStore();
  const { generations, loaded: generationsLoaded, refresh: refreshGenerations } = useGenerationsStore();

  useEffect(() => {
    if (!voicesLoaded) refreshVoices();
  }, [voicesLoaded, refreshVoices]);

  useEffect(() => {
    if (!generationsLoaded) refreshGenerations();
  }, [generationsLoaded, refreshGenerations]);

  const stats = useMemo(() => {
    const active = generations.filter((g) => g.status !== "archived");
    const totalMinutes = generations.reduce((sum, g) => sum + g.durationSeconds, 0) / 60;
    const weekAgo = Date.now() - WEEK_MS;
    const thisWeekMinutes =
      generations
        .filter((g) => new Date(g.createdAt).getTime() >= weekAgo)
        .reduce((sum, g) => sum + g.durationSeconds, 0) / 60;
    const clonedVoices = voices.filter((v) => v.source === "user").length;
    return { activeCount: active.length, totalMinutes, thisWeekMinutes, clonedVoices };
  }, [generations, voices]);

  const recentGenerations = useMemo(
    () =>
      [...generations]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5),
    [generations],
  );

  return (
    <div className="container max-w-6xl space-y-8 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's what's happening across your voices and projects.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Voices"
          value={String(voices.length)}
          delta={`${stats.clonedVoices} cloned by you`}
          trend="neutral"
          icon={Library}
        />
        <StatCard
          label="Generations"
          value={String(stats.activeCount)}
          delta={`${generations.length - stats.activeCount} archived`}
          trend="neutral"
          icon={FolderKanban}
        />
        <StatCard
          label="Minutes Generated"
          value={stats.totalMinutes.toFixed(1)}
          delta={`+${stats.thisWeekMinutes.toFixed(1)} this week`}
          trend={stats.thisWeekMinutes > 0 ? "up" : "neutral"}
          icon={Clock}
        />
        <StatCard
          label="Favorited"
          value={String(generations.filter((g) => g.favorite).length)}
          delta="starred generations"
          trend="neutral"
          icon={Sparkles}
        />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Button key={action.label} asChild variant="outline" className="h-auto flex-col gap-2 py-5">
              <Link to={action.href}>
                <action.icon className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">{action.label}</span>
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between p-5 pb-0">
            <h2 className="text-sm font-semibold">Recent Projects</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/projects">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <CardContent className="space-y-1 p-5">
            {!generationsLoaded ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">Loading…</p>
            ) : recentGenerations.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                No projects yet — generate some speech to see it here.
              </p>
            ) : (
              recentGenerations.map((generation) => (
                <Link
                  key={generation.id}
                  to="/app/projects"
                  className="flex items-center justify-between rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-secondary"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{generation.text}</p>
                    <p className="text-xs text-muted-foreground">
                      {generation.voiceName} · {formatDuration(generation.durationSeconds)} ·{" "}
                      {formatRelativeTime(generation.updatedAt)}
                    </p>
                  </div>
                  <ProjectStatusBadge status={generation.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <div className="flex items-center justify-between p-5 pb-0">
            <h2 className="text-sm font-semibold">Voices</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/voice-library">
                All voices <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <CardContent className="space-y-1 p-5">
            {voices.slice(0, 6).map((voice) => (
              <Link
                key={voice.id}
                to={`/app/generate-speech?voiceId=${voice.id}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-secondary"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-xs font-semibold text-white">
                  {voice.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{voice.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{voice.tags[0] ?? voice.description}</p>
                </div>
              </Link>
            ))}
            {voicesLoaded && voices.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">No voices yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
