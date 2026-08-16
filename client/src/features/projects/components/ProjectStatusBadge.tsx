import { Badge } from "@/components/ui/badge";
import type { GenerationStatus } from "@/services/tts-service";

const statusConfig: Record<GenerationStatus, { label: string; variant: "success" | "outline" }> = {
  ready: { label: "Ready", variant: "success" },
  archived: { label: "Archived", variant: "outline" },
};

export function ProjectStatusBadge({ status }: { status: GenerationStatus }) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
