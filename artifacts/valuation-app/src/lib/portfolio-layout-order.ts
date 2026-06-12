export type PortfolioOverviewCardId =
  | "total-value"
  | "arbitrage-opportunities"
  | "recent-valuation-change"
  | "asset-breakdown"
  | "market-insights"
  | "recent-activity"
  | "premium-analytics"
  | "international-arbitrage"
  | "historical-trends";

export type PortfolioSectionId = "overview" | "pro-workspace" | "folders" | "collection" | "hub-lower";

export const DEFAULT_PORTFOLIO_OVERVIEW_CARD_ORDER: PortfolioOverviewCardId[] = [
  "total-value",
  "arbitrage-opportunities",
  "recent-valuation-change",
  "asset-breakdown",
  "market-insights",
  "recent-activity",
  "premium-analytics",
  "international-arbitrage",
  "historical-trends",
];

export const DEFAULT_PORTFOLIO_SECTION_ORDER: PortfolioSectionId[] = [
  "overview",
  "pro-workspace",
  "folders",
  "collection",
  "hub-lower",
];

const OVERVIEW_STORAGE_KEY = "valyoued.portfolioOverviewOrder.v1";
const SECTION_STORAGE_KEY = "valyoued.portfolioSectionOrder.v1";

export function normalizeOrder<T extends string>(saved: unknown, defaults: readonly T[]): T[] {
  if (!Array.isArray(saved)) return [...defaults];
  const valid = saved.filter((id): id is T => typeof id === "string" && defaults.includes(id as T));
  const missing = defaults.filter((id) => !valid.includes(id));
  return [...valid, ...missing];
}

export function reorderIds<T extends string>(order: T[], fromId: T, toId: T): T[] {
  if (fromId === toId) return order;
  const next = [...order];
  const fromIdx = next.indexOf(fromId);
  const toIdx = next.indexOf(toId);
  if (fromIdx < 0 || toIdx < 0) return order;
  next.splice(fromIdx, 1);
  next.splice(toIdx, 0, fromId);
  return next;
}

function loadOrder<T extends string>(key: string, defaults: readonly T[]): T[] {
  if (typeof window === "undefined") return [...defaults];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [...defaults];
    return normalizeOrder(JSON.parse(raw), defaults);
  } catch {
    return [...defaults];
  }
}

function saveOrder(key: string, order: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(order));
  } catch {
    /* localStorage may be unavailable */
  }
}

export function loadPortfolioOverviewCardOrder(): PortfolioOverviewCardId[] {
  return loadOrder(OVERVIEW_STORAGE_KEY, DEFAULT_PORTFOLIO_OVERVIEW_CARD_ORDER);
}

export function savePortfolioOverviewCardOrder(order: PortfolioOverviewCardId[]): void {
  saveOrder(OVERVIEW_STORAGE_KEY, order);
}

export function loadPortfolioSectionOrder(): PortfolioSectionId[] {
  return loadOrder(SECTION_STORAGE_KEY, DEFAULT_PORTFOLIO_SECTION_ORDER);
}

export function savePortfolioSectionOrder(order: PortfolioSectionId[]): void {
  saveOrder(SECTION_STORAGE_KEY, order);
}

export const PORTFOLIO_OVERVIEW_CARD_LABELS: Record<PortfolioOverviewCardId, string> = {
  "total-value": "Total portfolio value",
  "arbitrage-opportunities": "Arbitrage opportunities",
  "recent-valuation-change": "Recent valuation change",
  "asset-breakdown": "Asset breakdown",
  "market-insights": "Market insights",
  "recent-activity": "Recent activity",
  "premium-analytics": "Premium analytics",
  "international-arbitrage": "International arbitrage",
  "historical-trends": "Historical trends",
};

export const PORTFOLIO_SECTION_LABELS: Record<PortfolioSectionId, string> = {
  overview: "Portfolio overview",
  "pro-workspace": "Professional workspaces",
  folders: "Hold / Monitor / Sell folders",
  collection: "Your collection",
  "hub-lower": "Asset buckets and ads",
};
