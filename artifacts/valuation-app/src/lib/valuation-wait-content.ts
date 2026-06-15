import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Globe2,
  Lightbulb,
  Scale,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { GLOSSARY } from "@/lib/estimate-glossary";

export type ValuationWaitInsightKind = "definition" | "arbitrage" | "fact" | "tip";

export type ValuationWaitInsight = {
  kind: ValuationWaitInsightKind;
  title: string;
  body: string;
  icon: LucideIcon;
};

const KIND_META: Record<
  ValuationWaitInsightKind,
  { label: string; icon: LucideIcon }
> = {
  definition: { label: "Definition", icon: BookOpen },
  arbitrage: { label: "Arbitrage", icon: Globe2 },
  fact: { label: "Did you know?", icon: Sparkles },
  tip: { label: "Valuing tip", icon: Lightbulb },
};

export function insightKindMeta(kind: ValuationWaitInsightKind) {
  return KIND_META[kind];
}

/** Rotating copy shown while a valuation is generated. */
export const VALUATION_WAIT_INSIGHTS: ValuationWaitInsight[] = [
  {
    kind: "definition",
    title: GLOSSARY.condition_scale.title,
    body: GLOSSARY.condition_scale.body,
    icon: Scale,
  },
  {
    kind: "definition",
    title: GLOSSARY.battery_health.title,
    body: GLOSSARY.battery_health.body,
    icon: GLOSSARY.battery_health.icon ?? BookOpen,
  },
  {
    kind: "definition",
    title: GLOSSARY.storage_tier.title,
    body: GLOSSARY.storage_tier.body,
    icon: GLOSSARY.storage_tier.icon ?? BookOpen,
  },
  {
    kind: "definition",
    title: GLOSSARY.unlocked_vs_locked.title,
    body: GLOSSARY.unlocked_vs_locked.body,
    icon: GLOSSARY.unlocked_vs_locked.icon ?? BookOpen,
  },
  {
    kind: "arbitrage",
    title: "What is arbitrage?",
    body: "Arbitrage is buying or selling in one market where price is higher after fees, shipping, and duties. ValYoued compares regions so you can see whether listing abroad beats selling locally.",
    icon: Globe2,
  },
  {
    kind: "arbitrage",
    title: "Fees change the best market",
    body: "A higher headline price in another country is not always better. Platform fees, currency conversion, insurance, and import VAT can erase the gap. We net these out in arbitrage rows on Pro reports.",
    icon: TrendingUp,
  },
  {
    kind: "arbitrage",
    title: "Currency and timing",
    body: "Exchange rates move daily. Luxury watches, phones, and collectibles often trade in USD or EUR even when you sell locally. We anchor comps in your listing currency but flag stronger payout regions when data allows.",
    icon: Globe2,
  },
  {
    kind: "fact",
    title: "Comps beat guesses",
    body: "Our model weights recent sold listings and auction results more heavily than asking prices. Asking prices sit on shelves; sold prices reveal what buyers actually paid.",
    icon: Sparkles,
  },
  {
    kind: "fact",
    title: "Specs move the needle",
    body: "Storage tier, colour, battery health, and box or papers can swing electronics and watch valuations by double-digit percentages. That is why we verify specs before generating your report.",
    icon: Sparkles,
  },
  {
    kind: "fact",
    title: "Seasonality matters",
    body: "Phones often dip after new launches. Tax refunds and holidays can lift luxury bags and sneakers. We scan recent market context so your estimate is not stuck in last year's news.",
    icon: Sparkles,
  },
  {
    kind: "tip",
    title: "Honest condition wins",
    body: "Under-stating wear risks lowball offers after inspection. Over-stating invites returns and bad feedback. A realistic condition score keeps your listing aligned with buyer expectations.",
    icon: Lightbulb,
  },
  {
    kind: "tip",
    title: "Photos sell the story",
    body: "Even when valuing, good photos help us extract brand and model hints. For listing, sharp images of serials, hallmarks, and defects build trust faster than paragraphs of text.",
    icon: Lightbulb,
  },
  {
    kind: "tip",
    title: "Region sets currency",
    body: "Pick the country or market where you plan to list. Comps, fees, and arbitrage rows are tuned to that region's buyers — not where the item was originally purchased.",
    icon: Lightbulb,
  },
  {
    kind: "definition",
    title: GLOSSARY.authentication_tiers.title,
    body: GLOSSARY.authentication_tiers.body,
    icon: GLOSSARY.authentication_tiers.icon ?? BookOpen,
  },
  {
    kind: "definition",
    title: GLOSSARY.wine_cellaring.title,
    body: GLOSSARY.wine_cellaring.body,
    icon: GLOSSARY.wine_cellaring.icon ?? BookOpen,
  },
];

export const VALUATION_PROGRESS_PHASES = [
  { label: "Initializing valuation models", weight: 0.08 },
  { label: "Pulling comparable sales", weight: 0.22 },
  { label: "Gathering regional price context", weight: 0.18 },
  { label: "Scanning market news and events", weight: 0.12 },
  { label: "Mapping international arbitrage", weight: 0.15 },
  { label: "Synthesizing your narrative", weight: 0.15 },
  { label: "Finalizing your report", weight: 0.1 },
] as const;

/** Typical end-to-end valuation duration used for time remaining (seconds). */
export const VALUATION_ESTIMATED_SECONDS = 55;

export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 3) return "Almost done…";
  if (seconds < 60) return `About ${Math.ceil(seconds)} seconds remaining`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  if (secs === 0) return `About ${mins} minute${mins === 1 ? "" : "s"} remaining`;
  return `About ${mins} min ${secs} sec remaining`;
}

export function computeValuationProgress(elapsedSec: number): {
  progressPct: number;
  remainingSec: number;
  phaseLabel: string;
} {
  const dynamicEstimate =
    elapsedSec > VALUATION_ESTIMATED_SECONDS ? elapsedSec + 25 : VALUATION_ESTIMATED_SECONDS;
  const rawProgress = (elapsedSec / dynamicEstimate) * 100;
  const progressPct = Math.min(96, Math.round(rawProgress));
  const remainingSec = Math.max(0, dynamicEstimate - elapsedSec);

  let cumulative = 0;
  const target = Math.min(0.96, elapsedSec / dynamicEstimate);
  let phaseLabel = VALUATION_PROGRESS_PHASES[VALUATION_PROGRESS_PHASES.length - 1].label;
  for (const phase of VALUATION_PROGRESS_PHASES) {
    cumulative += phase.weight;
    if (target <= cumulative) {
      phaseLabel = phase.label;
      break;
    }
  }

  return { progressPct, remainingSec, phaseLabel };
}
