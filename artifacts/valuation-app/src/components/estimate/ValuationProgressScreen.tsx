import { useEffect, useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  VALUATION_WAIT_INSIGHTS,
  computeValuationProgress,
  formatTimeRemaining,
  insightKindMeta,
} from "@/lib/valuation-wait-content";

type ValuationProgressScreenProps = {
  /** Optional item headline for context */
  itemTitle?: string;
  /** Optional asset type name, e.g. Smartphone */
  assetTypeName?: string;
  className?: string;
};

const INSIGHT_ROTATE_MS = 7000;
const TICK_MS = 250;

export function ValuationProgressScreen({
  itemTitle,
  assetTypeName,
  className,
}: ValuationProgressScreenProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [insightIndex, setInsightIndex] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const tick = window.setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, TICK_MS);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const rotate = window.setInterval(() => {
      setInsightIndex((i) => (i + 1) % VALUATION_WAIT_INSIGHTS.length);
    }, INSIGHT_ROTATE_MS);
    return () => window.clearInterval(rotate);
  }, []);

  const elapsedSec = elapsedMs / 1000;
  const { progressPct, remainingSec, phaseLabel } = useMemo(
    () => computeValuationProgress(elapsedSec),
    [elapsedSec],
  );

  const insight = VALUATION_WAIT_INSIGHTS[insightIndex];
  const kindMeta = insightKindMeta(insight.kind);
  const KindIcon = kindMeta.icon;

  return (
    <div
      className={cn(
        "mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-8 px-4 py-10",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="relative h-20 w-20">
          <div className="absolute inset-0 rounded-full border-4 border-accent/20" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <div className="absolute inset-0 flex items-center justify-center text-accent">
            <Calculator className="h-8 w-8" aria-hidden />
          </div>
        </div>
        <div className="space-y-1">
          <h2 className="font-sans text-2xl font-semibold tracking-tight">Valuing your asset</h2>
          {(itemTitle || assetTypeName) && (
            <p className="text-sm text-muted-foreground">
              {[assetTypeName, itemTitle].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">{phaseLabel}</span>
          <span className="shrink-0 tabular-nums font-medium text-foreground">
            {formatTimeRemaining(remainingSec)}
          </span>
        </div>
        <Progress value={progressPct} className="h-2.5" aria-valuenow={progressPct} />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{progressPct}% complete</span>
          <span className="tabular-nums">
            {Math.floor(elapsedSec)}s elapsed
          </span>
        </div>
      </div>

      <Card
        key={insightIndex}
        className="border-border/60 bg-card/80 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500"
      >
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1 font-normal">
              <KindIcon className="h-3.5 w-3.5" aria-hidden />
              {kindMeta.label}
            </Badge>
          </div>
          <h3 className="font-sans text-base font-semibold leading-snug">{insight.title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{insight.body}</p>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Complex items or busy periods can take a little longer. Your report will open automatically when ready.
      </p>
    </div>
  );
}
