import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingsSection } from "./components/SettingsSection";
import { ApiKeysForm } from "./components/ApiKeysForm";
import { useUiStore } from "@/store/ui-store";
import { useSettingsStore } from "./store/settings-store";
import { cn } from "@/lib/utils";

const shortcuts = [
  { keys: "⌘K", action: "Open command palette" },
  { keys: "Space", action: "Play / pause (editor)" },
  { keys: "S", action: "Split at playhead (editor)" },
  { keys: "T", action: "Trim to selection (editor)" },
  { keys: "⌘Z", action: "Undo" },
  { keys: "⌘⇧Z", action: "Redo" },
  { keys: "⌘G", action: "New generation" },
];

const languages = ["English (US)", "English (UK)", "Spanish", "French", "German", "Japanese"];

export default function SettingsPage() {
  const { theme, toggleTheme } = useUiStore();
  const { language, setLanguage, notifications, toggleNotification } = useSettingsStore();

  return (
    <div className="container max-w-2xl space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your workspace preferences.</p>
      </div>

      <SettingsSection title="Appearance">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <span>{theme === "dark" ? "Dark mode" : "Light mode"}</span>
          </div>
          <Button variant="outline" size="sm" onClick={toggleTheme}>
            Switch to {theme === "dark" ? "light" : "dark"}
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="Language">
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languages.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsSection>

      <SettingsSection title="Notifications">
        {(
          [
            { key: "generationComplete", label: "Generation complete" },
            { key: "cloneReady", label: "Voice clone ready" },
            { key: "weeklyDigest", label: "Weekly usage digest" },
            { key: "productUpdates", label: "Product updates" },
          ] as const
        ).map((item) => (
          <div key={item.key} className="flex items-center justify-between">
            <Label className="text-sm font-normal">{item.label}</Label>
            <Switch
              checked={notifications[item.key]}
              onCheckedChange={() => toggleNotification(item.key)}
            />
          </div>
        ))}
      </SettingsSection>

      <SettingsSection title="Storage" description="3.2 GB of 10 GB used">
        <Progress value={32} />
      </SettingsSection>

      <SettingsSection
        title="API Keys"
        description="Connect your own ElevenLabs, OpenAI, and Deepgram accounts."
      >
        <ApiKeysForm />
      </SettingsSection>

      <SettingsSection title="Keyboard Shortcuts">
        <div className="divide-y divide-border">
          {shortcuts.map((s) => (
            <div key={s.action} className={cn("flex items-center justify-between py-2 text-sm")}>
              <span className="text-muted-foreground">{s.action}</span>
              <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-xs">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}
