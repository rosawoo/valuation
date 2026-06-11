import { useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { customFetch } from "@workspace/api-client-react";
import { StubBillingPlanDevContext } from "@/context/StubBillingPlanDevContext";
import type { StubBillingPlanSlug } from "@/context/StubBillingPlanDevContext";
import { AUTH_STUB_MODE } from "@/lib/auth-stub";
import { isDevBillingUiEnabled } from "@/lib/dev-billing-ui";
import { apiUrl } from "@/lib/api-url";

const DEV_FREE_MONTHLY_CAP = 5;

function devSimulatedMeBilling(planSlug: StubBillingPlanSlug, hasInheritanceAddon: boolean): MeBillingResponse {
  const hasPaidValuationTier = planSlug !== "free";
  const apiPlanSlug = planSlug === "free" ? "none" : planSlug;
  const valuationsMonthLimit = hasPaidValuationTier ? null : DEV_FREE_MONTHLY_CAP;
  const valuationsRemainingFree =
    valuationsMonthLimit == null ? null : DEV_FREE_MONTHLY_CAP;
  return {
    tier: hasPaidValuationTier ? "pro" : "free",
    status: hasPaidValuationTier ? "dev_sim_active" : "inactive",
    stripeCustomerId: null,
    planSlug: apiPlanSlug,
    valuationsThisMonth: 0,
    valuationsMonthLimit,
    valuationsRemainingFree,
    hasPaidValuationTier,
    canUsePortfolioAnalytics: hasPaidValuationTier,
    canUseTraderWorkspace: planSlug === "professional",
    hasInheritanceAddon,
    comparableUiMode: hasPaidValuationTier ? "full" : "preview",
  };
}

/** Response from `GET /api/me/billing` (authenticated). */
export type MeBillingResponse = {
  tier: string;
  status: string;
  stripeCustomerId: string | null;
  planSlug: string;
  valuationsThisMonth?: number;
  valuationsMonthLimit: number | null;
  valuationsRemainingFree: number | null;
  hasPaidValuationTier: boolean;
  canUsePortfolioAnalytics?: boolean;
  canUseTraderWorkspace?: boolean;
  /** Separate inheritance workspace billing (standalone Stripe subscription). */
  hasInheritanceAddon?: boolean;
  /** comparable grid: preview shows first two comps for unsubscribed Everyday accounts on free-tier snapshots. */
  comparableUiMode?: "full" | "preview";
};

/** Server-backed billing + entitlement snapshot. Uses the shared Bearer token getter. */
export function useBillingSummary() {
  const stubDev = useContext(StubBillingPlanDevContext);
  const devTierSimActive = Boolean(isDevBillingUiEnabled() && stubDev && !AUTH_STUB_MODE);
  const stubSlug = stubDev?.planSlug ?? null;
  const stubInh = stubDev?.inheritanceAddon ?? false;

  const billingKey =
    devTierSimActive && stubSlug != null
      ? `sim:${stubSlug}:${stubInh ? "inh1" : "inh0"}`
      : AUTH_STUB_MODE && stubSlug != null
        ? `${stubSlug}:${stubInh ? "inh1" : "inh0"}`
        : "live";

  return useQuery({
    queryKey: ["me-billing", billingKey],
    staleTime: 60_000,
    queryFn: () => {
      if (devTierSimActive && stubDev) {
        return devSimulatedMeBilling(stubDev.planSlug, stubDev.inheritanceAddon);
      }
      return customFetch<MeBillingResponse>(apiUrl("/api/me/billing"), { method: "GET", responseType: "json" });
    },
  });
}
