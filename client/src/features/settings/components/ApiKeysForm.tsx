import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api-client";

const providers = [
  { key: "elevenLabsApiKey", label: "ElevenLabs API Key" },
  { key: "openAiApiKey", label: "OpenAI API Key" },
  { key: "deepgramApiKey", label: "Deepgram API Key" },
] as const;

type ProviderKey = (typeof providers)[number]["key"];

export function ApiKeysForm() {
  const [values, setValues] = useState<Record<ProviderKey, string>>({
    elevenLabsApiKey: "",
    openAiApiKey: "",
    deepgramApiKey: "",
  });
  const [visible, setVisible] = useState<Record<ProviderKey, boolean>>({
    elevenLabsApiKey: false,
    openAiApiKey: false,
    deepgramApiKey: false,
  });

  const mutation = useMutation({
    mutationFn: () => apiClient.post("/api/settings/api-keys", values),
    onSuccess: () => toast.success("API keys saved securely on the server."),
    onError: () => toast.error("Couldn't reach the server — start the backend to save keys."),
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Keys are sent directly to your own backend and stored server-side — they are never bundled
        into the browser app or exposed to the client.
      </p>
      {providers.map((provider) => (
        <div key={provider.key} className="space-y-1.5">
          <Label htmlFor={provider.key} className="text-xs">
            {provider.label}
          </Label>
          <div className="relative">
            <Input
              id={provider.key}
              type={visible[provider.key] ? "text" : "password"}
              placeholder="sk-••••••••••••••••"
              value={values[provider.key]}
              onChange={(e) => setValues((v) => ({ ...v, [provider.key]: e.target.value }))}
              className="pr-9"
            />
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setVisible((v) => ({ ...v, [provider.key]: !v[provider.key] }))}
            >
              {visible[provider.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Save keys
      </Button>
    </div>
  );
}
