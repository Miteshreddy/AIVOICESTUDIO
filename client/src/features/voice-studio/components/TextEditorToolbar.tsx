import { useMutation } from "@tanstack/react-query";
import { Wand2, Minimize2, Maximize2, Languages, SpellCheck2, Smile, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { runTextAiAction, type TextAiAction } from "@/services/text-ai-service";
import { useState } from "react";

const tools: { action: TextAiAction; label: string; icon: typeof Wand2 }[] = [
  { action: "rewrite", label: "AI Rewrite", icon: Wand2 },
  { action: "summarize", label: "Summarize", icon: Minimize2 },
  { action: "expand", label: "Expand", icon: Maximize2 },
  { action: "grammar", label: "Grammar Fix", icon: SpellCheck2 },
];

const emotions = ["Excited", "Calm", "Serious", "Playful", "Dramatic", "Sad"];
const languages = ["Spanish", "French", "German", "Japanese", "Hindi", "Portuguese"];

export function TextEditorToolbar({
  text,
  onResult,
}: {
  text: string;
  onResult: (result: string) => void;
}) {
  const [emotion, setEmotion] = useState(emotions[0]);
  const [language, setLanguage] = useState(languages[0]);

  const mutation = useMutation({
    mutationFn: runTextAiAction,
    onSuccess: (data) => onResult(data.result),
    onError: () => {
      toast.error("AI text service isn't connected yet — start the backend to enable this.");
    },
  });

  function run(action: TextAiAction, extra?: Partial<{ targetLanguage: string; emotion: string }>) {
    if (!text.trim()) {
      toast.warning("Write some text first.");
      return;
    }
    mutation.mutate({ text, action, ...extra });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
      {tools.map((tool) => (
        <Button
          key={tool.action}
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={mutation.isPending}
          onClick={() => run(tool.action)}
        >
          <tool.icon className="h-3.5 w-3.5" /> {tool.label}
        </Button>
      ))}

      <div className="flex items-center gap-1">
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="h-7 w-28 text-xs">
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
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={mutation.isPending}
          onClick={() => run("translate", { targetLanguage: language })}
        >
          <Languages className="h-3.5 w-3.5" /> Translate
        </Button>
      </div>

      <div className="flex items-center gap-1">
        <Select value={emotion} onValueChange={setEmotion}>
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {emotions.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={mutation.isPending}
          onClick={() => run("emotion", { emotion })}
        >
          <Smile className="h-3.5 w-3.5" /> Emotion Rewrite
        </Button>
      </div>

      {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </div>
  );
}
