import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  Briefcase,
  Plus,
  Calculator,
  LayoutDashboard,
  Megaphone,
  Globe2,
} from "lucide-react";
import type { UseQueryOptions } from "@tanstack/react-query";
import { useListEstimates, listEstimates, useGetFxRates, getGetFxRatesQueryKey } from "@workspace/api-client-react";
import type { EstimateSummary } from "@workspace/api-client-react";
import { convertToUsdApprox } from "@workspace/fx-usd";
import { formatUsdRollupForDisplay } from "@/lib/aggregated-money";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { GenerateListingDialog } from "@/components/GenerateListingDialog";
import { PortfolioFolders } from "@/components/PortfolioFolders";
import {
  mergePortfolioHref,
  usePortfolioWorkspace,
} from "@/context/PortfolioWorkspaceContext";
import { estimateInActiveWorkspace } from "@/lib/portfolio-workspace-scope";
import { useBillingSummary } from "@/hooks/use-billing-summary";
import { ProfessionalWorkspaceRollup } from "@/components/portfolio/ProfessionalWorkspaceRollup";
import { DashboardHubLower } from "@/components/dashboard/DashboardHubLower";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { PortfolioAssetCard } from "@/components/portfolio/PortfolioAssetCard";
import { PageTitle } from "@/components/layout/PageTitle";
import { ReorderableSections } from "@/components/portfolio/ReorderableSections";
import {
  loadPortfolioSectionOrder,
  PORTFOLIO_SECTION_LABELS,
  savePortfolioSectionOrder,
  type PortfolioSectionId,
} from "@/lib/portfolio-layout-order";

type PortfolioItem = EstimateSummary & {
  liveValue: number;
  changeFromBaseline: number;
};

type ClassAlbum = {
  name: string;
  items: PortfolioItem[];
  totalUsd: number;
  baselineUsd: number;
  change: number;
};

type PortfolioShelf = EstimateSummary["portfolioShelf"];

function buildClassAlbums(
  items: PortfolioItem[],
  mult: Readonly<Record<string, number>> | null | undefined,
): ClassAlbum[] {
  if (items.length === 0) return [];
  const map = new Map<string, PortfolioItem[]>();
  for (const p of items) {
    const arr = map.get(p.assetTypeName) ?? [];
    arr.push(p);
    map.set(p.assetTypeName, arr);
  }
  return Array.from(map.entries())
    .map(([name, rows]) => {
      const totalUsd = rows.reduce((s, i) => s + convertToUsdApprox(i.liveValue, i.currency, mult), 0);
      const baselineUsd = rows.reduce((s, i) => s + convertToUsdApprox(i.baselineMid, i.currency, mult), 0);
      const change = baselineUsd > 0 ? (totalUsd - baselineUsd) / baselineUsd : 0;
      return { name, items: rows, totalUsd, baselineUsd, change };
    })
    .sort((a, b) => b.totalUsd - a.totalUsd);
}

const SHELF_SECTION_META: Record<
  PortfolioShelf,
  { title: string; description: string }
> = {
  luxury: {
    title: "Luxury & collectibles",
    description: "High-end and collectible items from the luxury valuation track.",
  },
  everyday: {
    title: "Everyday & tech",
    description: "Day-to-day and mass-market items from the standard track.",
  },
  other: {
    title: "Other holdings",
    description: "Anything that spans tracks or doesn't fit neatly above (vehicles, property, mixed runs, and similar).",
  },
};

const POLL_INTERVAL_MS = 60_000;

/** Line under page title when it adds detail; hides labels that repeat the portfolio heading. */
function portfolioWorkspaceSubtitle(
  active: { label?: string | null; purpose?: string } | null | undefined,
): string | null {
  if (!active) return null;
  const trimmed = active.label?.trim();
  let redundantLabel = false;
  if (trimmed) {
    const norm = trimmed.toLowerCase().replace(/\s+/g, " ").trim();
    if (norm === "my portfolio" || norm === "portfolio") {
      redundantLabel = true;
    } else {
      return trimmed;
    }
  }
  if (active.purpose === "pro_board") return "Professional board";
  if (active.purpose === "inheritance") return "Inheritance workspace";
  if (redundantLabel && active.purpose === "primary") return null;
  return "Primary";
}

const PALETTE = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#06b6d4", "#ef4444", "#84cc16", "#f97316", "#6366f1",
];

function PortfolioPageHeader({
  subtitle,
  action,
}: {
  subtitle: string | null;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-4">
      <div>
        <PageTitle>Portfolio</PageTitle>
        {subtitle ? (
          <p className="mt-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export default function PortfolioPage() {
  const { code: displayCcy } = useDisplayCurrency();
  const { data: billing } = useBillingSummary();
  const portfolioAnalytics = Boolean(billing?.canUsePortfolioAnalytics);
  const { portfolioQuerySuffix, activePortfolio, primaryPortfolio } = usePortfolioWorkspace();

  const { data: estimates, isLoading } = useListEstimates({
    query: {
      refetchInterval: POLL_INTERVAL_MS,
    } as unknown as UseQueryOptions<Awaited<ReturnType<typeof listEstimates>>, Error>,
  });

  const { data: fxSnap } = useGetFxRates({
    query: {
      queryKey: getGetFxRatesQueryKey(),
      staleTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  });

  const estimateRows = useMemo(
    () => (Array.isArray(estimates) ? estimates : []),
    [estimates],
  );

  const scopedRows = useMemo(() => {
    const act = activePortfolio?.id ?? null;
    const prim = primaryPortfolio?.id ?? null;
    return estimateRows.filter((e) => estimateInActiveWorkspace(e, act, prim));
  }, [estimateRows, activePortfolio?.id, primaryPortfolio?.id]);

  const [listingFor, setListingFor] = useState<EstimateSummary | null>(null);
  const [sectionOrder, setSectionOrder] = useState<PortfolioSectionId[]>(loadPortfolioSectionOrder);

  useEffect(() => {
    savePortfolioSectionOrder(sectionOrder);
  }, [sectionOrder]);

  const portfolio = useMemo(() => {
    if (scopedRows.length === 0) return [];
    return scopedRows.map((e) => {
      const liveValue = e.adjustedMid;
      const changeFromBaseline = e.baselineMid > 0 ? (liveValue - e.baselineMid) / e.baselineMid : 0;
      return { ...e, liveValue, changeFromBaseline };
    });
  }, [scopedRows]);

  const classAlbums = useMemo(
    () => buildClassAlbums(portfolio, fxSnap?.rates),
    [portfolio, fxSnap?.rates],
  );

  const shelfSections = useMemo(() => {
    const order: PortfolioShelf[] = ["luxury", "everyday", "other"];
    const mult = fxSnap?.rates;
    return order
      .map((shelf) => {
        const slice = portfolio.filter((p) => p.portfolioShelf === shelf);
        if (slice.length === 0) return null;
        const meta = SHELF_SECTION_META[shelf];
        return {
          shelf,
          title: meta.title,
          description: meta.description,
          albums: buildClassAlbums(slice, mult),
          sectionTotalUsd: slice.reduce((s, i) => s + convertToUsdApprox(i.liveValue, i.currency, mult), 0),
        };
      })
      .filter((s): s is NonNullable<typeof s> => s != null);
  }, [portfolio, fxSnap?.rates]);

  const totalPortfolioUsd = classAlbums.reduce((s, a) => s + a.totalUsd, 0);
  const totalBaselineUsd = classAlbums.reduce((s, a) => s + a.baselineUsd, 0);
  const totalChange = totalBaselineUsd > 0 ? (totalPortfolioUsd - totalBaselineUsd) / totalBaselineUsd : 0;

  const pieData = classAlbums.map((a, i) => ({
    name: a.name,
    value: Math.round(a.totalUsd),
    pct: totalPortfolioUsd > 0 ? a.totalUsd / totalPortfolioUsd : 0,
    color: PALETTE[i % PALETTE.length],
  }));

  // Diversification score: 0 = single asset class, 100 = perfectly even across many classes
  const diversificationScore = useMemo(() => {
    if (pieData.length === 0) return 0;
    if (pieData.length === 1) return 0;
    const hhi = pieData.reduce((s, p) => s + p.pct * p.pct, 0); // Herfindahl index
    const normalized = (1 - hhi) / (1 - 1 / pieData.length);
    return Math.round(normalized * 100);
  }, [pieData]);

  const fxMult = fxSnap?.rates;

  const formatRollup = (usd: number) => formatUsdRollupForDisplay(usd, displayCcy, fxMult);

  const portfolioHeaderSubtitle = portfolioWorkspaceSubtitle(activePortfolio);

  const hubLowerProps = {
    scopedEstimates: scopedRows,
    estimatesLoading: isLoading,
  };

  const newValuationButton = (
    <Link href={mergePortfolioHref("/estimate/new", portfolioQuerySuffix)}>
      <Button>
        <Plus className="h-4 w-4 mr-2" />
        New valuation
      </Button>
    </Link>
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-8">
        <PortfolioPageHeader subtitle={portfolioHeaderSubtitle} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (scopedRows.length === 0) {
    const nonPrimaryWorkspace =
      activePortfolio && primaryPortfolio && activePortfolio.id !== primaryPortfolio.id;

    return (
      <div className="mx-auto max-w-6xl space-y-8 pb-16">
        <PortfolioPageHeader subtitle={portfolioHeaderSubtitle} action={newValuationButton} />
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/30 p-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
            <Briefcase className="h-8 w-8 text-accent" />
          </div>
          <h3 className="mb-2 font-sans text-2xl">
            {nonPrimaryWorkspace
              ? `${activePortfolio?.label ?? "This workspace"} is empty`
              : "Your portfolio is empty"}
          </h3>
          <p className="mb-6 max-w-md text-muted-foreground">
            {nonPrimaryWorkspace
              ? "Run a valuation and attach it to this workspace. Pick another workspace in Settings to see your main portfolio."
              : "Run a valuation and attach it to this workspace to see holdings, shelf mix, and listing shortcuts."}
          </p>
          <Link href={mergePortfolioHref("/estimate/new", portfolioQuerySuffix)}>
            <Button size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Value your first asset
            </Button>
          </Link>
        </div>
        </div>
        <DashboardHubLower {...hubLowerProps} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-16">
      <PortfolioPageHeader subtitle={portfolioHeaderSubtitle} action={newValuationButton} />

      <nav
        className="flex flex-wrap gap-2 rounded-2xl border border-border/60 bg-card/50 p-2"
        aria-label="Quick actions"
      >
        {[
          { href: mergePortfolioHref("/estimate/new", portfolioQuerySuffix), label: "Valuate", icon: Calculator },
          { href: mergePortfolioHref("/estimates", portfolioQuerySuffix), label: "Recent", icon: LayoutDashboard },
          { href: mergePortfolioHref("/markets", portfolioQuerySuffix), label: "Regions", icon: Globe2 },
          { href: mergePortfolioHref("/listings", portfolioQuerySuffix), label: "Ads", icon: Megaphone },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden />
              {action.label}
            </Link>
          );
        })}
      </nav>

      <ReorderableSections
        order={sectionOrder}
        onReorder={setSectionOrder}
        labelForId={(id) => PORTFOLIO_SECTION_LABELS[id]}
        renderSection={(sectionId) => {
          switch (sectionId) {
            case "overview":
              return (
                <DashboardOverview
                  totalPortfolioUsd={totalPortfolioUsd}
                  totalChange={totalChange}
                  formatRollup={formatRollup}
                  pieData={pieData}
                  diversificationScore={diversificationScore}
                  portfolio={portfolio}
                  scopedEstimates={scopedRows}
                />
              );
            case "pro-workspace":
              return (
                <ProfessionalWorkspaceRollup
                  estimateRows={estimateRows}
                  formatRollup={formatRollup}
                  fxMult={fxMult}
                />
              );
            case "folders":
              return (
                <PortfolioFolders
                  items={portfolio.map((p) => ({
                    id: p.id,
                    title: p.title,
                    assetTypeName: p.assetTypeName,
                    liveValue: p.liveValue,
                    currency: p.currency,
                  }))}
                />
              );
            case "collection":
              return (
                <section className="space-y-8" id="collection-section" data-testid="collection-section">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">Your collection</h2>
                  </div>

                  <div className="space-y-12">
                    {shelfSections.map((section) => {
                      const items = portfolio
                        .filter((p) => p.portfolioShelf === section.shelf)
                        .sort(
                          (a, b) =>
                            convertToUsdApprox(b.liveValue, b.currency, fxMult) -
                            convertToUsdApprox(a.liveValue, a.currency, fxMult),
                        );
                      const count = items.length;
                      return (
                        <div key={section.shelf} className="space-y-4" data-testid={`shelf-${section.shelf}`}>
                          <div className="flex flex-col gap-3 border-b border-border/40 pb-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="min-w-0 space-y-1.5">
                              <div className="flex flex-wrap items-baseline gap-2">
                                <h3 className="text-lg font-semibold tracking-tight text-foreground">{section.title}</h3>
                                <span className="text-xs tabular-nums text-muted-foreground">
                                  {count} {count === 1 ? "item" : "items"}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed max-w-prose">
                                {section.description}
                              </p>
                            </div>
                            <div className="shrink-0 sm:text-right">
                              <p className="text-[11px] text-muted-foreground">Group total (approx.)</p>
                              <p className="text-lg font-semibold tabular-nums text-foreground">{formatRollup(section.sectionTotalUsd)}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {items.map((item) => (
                              <PortfolioAssetCard
                                key={item.id}
                                item={item}
                                portfolioAnalytics={portfolioAnalytics}
                                onListing={() => setListingFor(item)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            case "hub-lower":
              return <DashboardHubLower {...hubLowerProps} />;
            default:
              return null;
          }
        }}
      />

      {listingFor && (
        <GenerateListingDialog
          estimateId={listingFor.id}
          estimateTitle={listingFor.title}
          assetTypeName={listingFor.assetTypeName}
          sellerRegion={listingFor.currentRegion ?? listingFor.bestArbitrageRegion}
          open={true}
          onOpenChange={(open) => !open && setListingFor(null)}
        />
      )}
    </div>
  );
}
