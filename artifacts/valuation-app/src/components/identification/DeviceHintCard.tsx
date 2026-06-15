import { Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SettingsHint } from "@/lib/identification/device-hints";

type DeviceHintCardProps = {
  hint: SettingsHint;
  className?: string;
};

export function DeviceHintCard({ hint, className }: DeviceHintCardProps) {
  return (
    <Card className={`border-accent/20 bg-accent/5 ${className ?? ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Info className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          {hint.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          {hint.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {hint.note ? <p className="text-xs text-muted-foreground">{hint.note}</p> : null}
        <div
          className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/30 text-xs text-muted-foreground"
          aria-hidden
        >
          Screenshot placeholder — open Settings on your device to follow the steps above
        </div>
      </CardContent>
    </Card>
  );
}
