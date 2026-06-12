import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  BarChart3,
  Globe2,
  LineChart,
  PieChart as PieIcon,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EstimateSummary } from "@workspace/api-client-react";
import { useGetEstimateStats } from "@workspace/api-client-react";
import { mergePortfolioHref, usePortfolioWorkspace } from "@/context/PortfolioWorkspaceContext";
import { useBillingSummary } from "@/hooks/use-billing-summary";
import { formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LockedProOverlay } from "@/components/home/LockedProFeature";
import { HOME_BUCKET_LABEL, bucketForAssetTypeName } from "@/lib/home-buckets";
import { ReorderableGrid } from "@/components/portfolio/ReorderableGrid";
import {
  loadPortfolioOverviewCardOrder,
  PORTFOLIO_OVERVIEW_CARD_LABELS,
  savePortfolioOverviewCardOrder,
  type PortfolioOverviewCardId,
} from "@/lib/portfolio-layout-order";

type PieSlice = {
  name: string;
  value: number;
  pct: number;
  color: string;
};

type PortfolioRow = EstimateSummary & {
  liveValue: number;
  changeFromBaseline: number;
};

function OverviewCard({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: typeof Activity;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex h-full flex-col border-border/60 bg-card/60 backdrop-blur-sm", className)}>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          {title}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">{children}</CardContent>
    </Card>
  );
}

export function DashboardOverview({
  totalPortfolioUsd,
  totalChange,
  formatRollup,
  pieData,
  diversificationScore,
  portfolio,
  scopedEstimates,
  statsLoading,
}: {
  totalPortfolioUsd: number;
  totalChange: number;
  formatRollup: (usd: number) => string;
  pieData: PieSlice[];
  diversificationScore: number;
  portfolio: PortfolioRow[];
  scopedEstimates: EstimateSummary[];
  statsLoading?: boolean;
}) {
  const { portfolioQuerySuffix } = usePortfolioWorkspace();
  const { data: billing } = useBillingSummary();
  const { data: stats, isLoading: estimateStatsLoading } = useGetEstimateStats();
  const billingPaid = Boolean(billing?.hasPaidValuationTier);
  const portfolioAnalytics = Boolean(billing?.canUsePortfolioAnalytics);
  const [pickedRegionIdx, setPickedRegionIdx] = useState<number | null>(null);
  const [cardOrder, setCardOrder] = useState<PortfolioOverviewCardId[]>(loadPortfolioOverviewCardOrder);

  useEffect(() => {
    savePortfolioOverviewCardOrder(cardOrder);
  }, [cardOrder]);

  const loading = statsLoading || estimateStatsLoading;

  const recentEstimate = useMemo(() => {
    return [...scopedEstimates].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
  }, [scopedEstimates]);

  const recentChange = useMemo(() => {
    if (!recentEstimate) return null;
    const row = portfolio.find((p) => p.id === recentEstimate.id);
    return row?.changeFromBaseline ?? null;
  }, [recentEstimate, portfolio]);

  const recentActivity = useMemo(
    () =>
      [...scopedEstimates]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 4),
    [scopedEstimates],
  );

  const trendData = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const row of scopedEstimates) {
      const d = new Date(row.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, count]) => ({
        month: month.slice(5) + "/" + month.slice(2, 4),
        count,
      }));
  }, [scopedEstimates]);

  const topRegions = stats?.topArbitrageRegions ?? [];
  const arbitrageCount = topRegions.reduce((sum, r) => sum + (r.count ?? 0), 0);
  const topRegion = topRegions[0]?.region;

  const health = stats?.portfolioHealth;

  function renderOverviewCard(id: PortfolioOverviewCardId): ReactNode {
    switch (id) {
      case "total-value":
        return (
          <Link
            href="#collection-section"
            className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <OverviewCard title="Total portfolio value" icon={Activity} className="transition-colors hover:border-accent/35">
              <CardTitle className="text-3xl font-sans tabular-nums tracking-tight">{formatRollup(totalPortfolioUsd)}</CardTitle>
              <p
                className={cn(
                  "mt-2 text-sm tabular-nums",
                  totalChange >= 0
                    ? "text-emerald-800/85 dark:text-emerald-400/90"
                    : "text-rose-800/85 dark:text-rose-400/90",
                )}
              >
                {formatPercent(totalChange, true)} vs. baseline
              </p>
            </OverviewCard>
          </Link>
        );
      case "arbitrage-opportunities":
        return (
          <OverviewCard title="Arbitrage opportunities" icon={Globe2}>
            {loading ? (
              <Skeleton className="h-10 w-32" />
            ) : topRegions.length > 0 ? (
              <>
                <CardTitle className="text-3xl font-sans tabular-nums">{arbitrageCount}</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Saved runs flagged across {topRegions.length} region{topRegions.length === 1 ? "" : "s"}
                  {topRegion ? (
                    <>
                      {" "}
                      · top: <span className="font-medium text-foreground">{topRegion}</span>
                    </>
                  ) : null}
                </p>
                <Button variant="link" className="mt-auto h-auto px-0 text-accent" asChild>
                  <Link href={mergePortfolioHref("/markets", portfolioQuerySuffix)}>Open markets</Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Regional opportunities appear after you save more valuations.
              </p>
            )}
          </OverviewCard>
        );
      case "recent-valuation-change":
        return (
          <OverviewCard title="Recent valuation change" icon={TrendingUp}>
            {recentEstimate && recentChange != null ? (
              <>
                <CardTitle
                  className={cn(
                    "text-3xl font-sans tabular-nums",
                    recentChange >= 0
                      ? "text-emerald-800/85 dark:text-emerald-400/90"
                      : "text-rose-800/85 dark:text-rose-400/90",
                  )}
                >
                  {formatPercent(recentChange, true)}
                </CardTitle>
                <p className="mt-2 truncate text-sm text-muted-foreground">{recentEstimate.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(recentEstimate.createdAt), { addSuffix: true })}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Run a valuation to track changes here.</p>
            )}
          </OverviewCard>
        );
      case "asset-breakdown":
        return (
          <OverviewCard title="Asset breakdown" icon={PieIcon}>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add holdings to see allocation.</p>
            ) : (
              <>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={32}
                        outerRadius={56}
                        paddingAngle={2}
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      >
                        {pieData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 6,
                          fontSize: 12,
                        }}
                        formatter={(v: number, n: string) => [formatRollup(Number(v)), n]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Diversification score: {diversificationScore}/100
                </p>
              </>
            )}
          </OverviewCard>
        );
      case "market-insights":
        return (
          <OverviewCard title="Market insights" icon={Sparkles}>
            {loading ? (
              <Skeleton className="h-24 w-full rounded-xl" />
            ) : topRegions.length > 0 ? (
              <div className="space-y-2">
                {topRegions.slice(0, 3).map((r, idx) => {
                  const total = topRegions.reduce((s, row) => s + (row.count ?? 0), 0) || 1;
                  const pct = (r.count ?? 0) / total;
                  const focused = pickedRegionIdx === idx;
                  return (
                    <button
                      key={`${r.region}-${idx}`}
                      type="button"
                      onClick={() => setPickedRegionIdx((i) => (i === idx ? null : idx))}
                      aria-pressed={focused}
                      className={cn(
                        "relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                        "border-border/60 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                        focused && "border-accent/50 bg-accent/10",
                      )}
                    >
                      <div
                        className="pointer-events-none absolute inset-y-0 left-0 bg-accent/20"
                        style={{ width: `${Math.round(pct * 100)}%` }}
                      />
                      <span className="relative z-10 flex items-center justify-between gap-3">
                        <span className="truncate font-medium">{r.region}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{formatPercent(pct)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Insights fill in as your workspace grows.</p>
            )}
          </OverviewCard>
        );
      case "recent-activity":
        return (
          <OverviewCard title="Recent activity" icon={Activity}>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved valuations yet.</p>
            ) : (
              <ul className="divide-y divide-border/50 rounded-lg border border-border/60">
                {recentActivity.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={mergePortfolioHref(`/estimates/${e.id}`, portfolioQuerySuffix)}
                      className="block px-3 py-2.5 text-sm transition-colors hover:bg-muted/30 hover:text-accent"
                    >
                      <div className="truncate font-medium text-foreground">{e.title}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{HOME_BUCKET_LABEL[bucketForAssetTypeName(e.assetTypeName)]}</span>
                        <span className="tabular-nums">{formatMoney(e.adjustedMid, e.currency, true)}</span>
                        <span>{formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="link" className="mt-auto h-auto px-0 pt-2 text-accent" asChild>
              <Link href={mergePortfolioHref("/estimates", portfolioQuerySuffix)}>View all</Link>
            </Button>
          </OverviewCard>
        );
      case "premium-analytics":
        return (
          <Card className="relative flex h-full flex-col overflow-hidden border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <BarChart3 className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                Premium analytics
              </CardDescription>
            </CardHeader>
            <CardContent className="relative flex flex-1 flex-col">
              {portfolioAnalytics && health ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border border-border/50 bg-background/80 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Resale strength</p>
                    <p className="mt-1 font-semibold tabular-nums">{health.resaleStrengthIndex}/100</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-background/80 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Diversification</p>
                    <p className="mt-1 font-semibold tabular-nums">{health.diversificationScore}/100</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-background/80 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Underinsured</p>
                    <p className="mt-1 font-semibold tabular-nums">{health.underinsuredCount}</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-background/80 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Needs revaluation</p>
                    <p className="mt-1 font-semibold tabular-nums">{health.needsRevaluationCount}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="pointer-events-none select-none space-y-2 blur-[2px] opacity-60" aria-hidden>
                    <div className="grid grid-cols-2 gap-2">
                      {["Resale strength", "Diversification", "Underinsured", "Missing receipts"].map((label) => (
                        <div key={label} className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground">
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                  <LockedProOverlay
                    title="Premium analytics"
                    description="Portfolio health scores, insurance gaps, and revaluation alerts unlock on Everyday."
                    cta="View plans and upgrade"
                  />
                </>
              )}
            </CardContent>
          </Card>
        );
      case "international-arbitrage":
        return (
          <Card className="relative flex h-full flex-col overflow-hidden border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Globe2 className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                International arbitrage
              </CardDescription>
            </CardHeader>
            <CardContent className="relative flex flex-1 flex-col">
              {billingPaid ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Compare net payout across regions on each valuation report and in the markets cockpit.
                  </p>
                  <Button variant="outline" className="mt-auto w-full justify-between rounded-xl" asChild>
                    <Link href={mergePortfolioHref("/markets", portfolioQuerySuffix)}>
                      Open markets cockpit
                      <TrendingUp className="h-4 w-4" />
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <div className="pointer-events-none select-none blur-[2px] opacity-60" aria-hidden>
                    <div className="space-y-2 rounded-xl border border-dashed border-border/80 bg-card/40 px-3 py-6 text-center text-xs text-muted-foreground">
                      Regional payout grid · cross-border fees · net seller proceeds
                    </div>
                  </div>
                  <LockedProOverlay
                    title="International arbitrage"
                    description="Everyday unlocks multi-market payout rows on reports and the full markets cockpit."
                    cta="View plans and upgrade"
                  />
                </>
              )}
            </CardContent>
          </Card>
        );
      case "historical-trends":
        return (
          <OverviewCard title="Historical trends" icon={LineChart}>
            {trendData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Valuation history builds as you save more runs.</p>
            ) : (
              <>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <RechartsTooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 6,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Valuations" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Valuations saved per month (last 6 periods).</p>
              </>
            )}
          </OverviewCard>
        );
      default:
        return null;
    }
  }

  return (
    <ReorderableGrid
      order={cardOrder}
      onReorder={setCardOrder}
      renderItem={renderOverviewCard}
      labelForId={(id) => PORTFOLIO_OVERVIEW_CARD_LABELS[id]}
      className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
    />
  );
}
