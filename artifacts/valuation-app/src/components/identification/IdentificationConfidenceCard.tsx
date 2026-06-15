import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ConfidenceResult } from "@/lib/identification/types";

type IdentificationConfidenceCardProps = {
  result: ConfidenceResult;
  onConfirm: () => void;
  onContinue: () => void;
};

export function IdentificationConfidenceCard({
  result,
  onConfirm,
  onContinue,
}: IdentificationConfidenceCardProps) {
  const { primary, alternatives, confidencePct } = result;
  if (!primary) return null;

  const highConfidence = confidencePct >= 90;

  return (
    <div className="space-y-5 rounded-2xl border border-accent/30 bg-accent/5 p-5">
      {highConfidence ? (
        <p className="text-base font-semibold leading-snug">
          We believe this item is an{" "}
          <span className="text-accent">{primary.label}</span>.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Based on your answers, here is our best match so far.
        </p>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Most likely match</span>
          <span className="tabular-nums font-semibold text-accent">{confidencePct}%</span>
        </div>
        <p className="text-lg font-sans font-semibold">{primary.label}</p>
        <Progress value={confidencePct} className="h-2" />
      </div>

      {alternatives.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Alternative matches
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {alternatives.map((alt) => (
              <li key={alt.id}>
                {alt.label}{" "}
                <span className="tabular-nums text-foreground/70">({alt.score}%)</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" onClick={onConfirm}>
          Confirm match
        </Button>
        <Button type="button" variant="outline" onClick={onContinue}>
          Continue identifying
        </Button>
      </div>
    </div>
  );
}
