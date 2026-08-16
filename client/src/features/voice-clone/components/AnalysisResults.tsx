import { AlertTriangle, CheckCircle2, Waves } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/utils";
import type { CloneAnalysis } from "../store/voice-clone-store";

function qualityLabel(score: number) {
  if (score >= 85) return { label: "Excellent", variant: "success" as const };
  if (score >= 65) return { label: "Good", variant: "warning" as const };
  return { label: "Needs improvement", variant: "destructive" as const };
}

export function AnalysisResults({
  analysis,
  onTrain,
  onBack,
  disabled,
}: {
  analysis: CloneAnalysis;
  onTrain: () => void;
  onBack: () => void;
  disabled?: boolean;
}) {
  const quality = qualityLabel(analysis.qualityScore);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Estimated clone quality</p>
            <p className="text-3xl font-semibold tracking-tight">{analysis.qualityScore}%</p>
          </div>
          <Badge variant={quality.variant} className="text-sm">
            {quality.label}
          </Badge>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Speech clarity</span>
              <span className="font-medium">{analysis.clarityScore}%</span>
            </div>
            <Progress value={analysis.clarityScore} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Background noise</span>
              <span className="font-medium">{analysis.noiseLevel}%</span>
            </div>
            <Progress value={analysis.noiseLevel} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Waves className="h-4 w-4" /> Sample length
            </span>
            <span className="text-sm font-medium">{formatDuration(analysis.durationSeconds)}</span>
          </CardContent>
        </Card>
      </div>

      {analysis.warnings.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="space-y-2 p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-warning">
              <AlertTriangle className="h-4 w-4" /> Recommendations
            </p>
            <ul className="space-y-1 pl-6 text-sm text-muted-foreground">
              {analysis.warnings.map((w) => (
                <li key={w} className="list-disc">
                  {w}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {analysis.warnings.length === 0 && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="flex items-center gap-2 p-5 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4" /> Samples look great — ready to train.
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button variant="brand" onClick={onTrain} disabled={disabled}>
          Clone voice
        </Button>
      </div>
    </div>
  );
}
