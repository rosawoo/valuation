import { logger } from "./logger";
import { mapBillingStubPlanTokenToSlug, type AuthStubResolvedPlanSlug } from "./authStubBillingPlan";

function truthy(v: string | undefined): boolean {
  return v === "1" || v?.toLowerCase() === "true";
}

let warnedStripeStubEntitlementsOutsideDev = false;

/**
 * Enables entitlement overlays driven by `STRIPE_STUB_PLAN` when:
 * `DISABLE_STRIPE_STUB_ENTITLEMENTS` is not `1`, and (`NODE_ENV=development`, or explicit `ALLOW_STRIPE_STUB_ENTITLEMENTS=1`).
 *
 * Unsafe on public deployments.
 */
export function shouldTrustStripeStubEntitlementsFromEnv(): boolean {
  if (process.env.DISABLE_STRIPE_STUB_ENTITLEMENTS === "1") return false;
  if (truthy(process.env.ALLOW_STRIPE_STUB_ENTITLEMENTS)) {
    if (process.env.NODE_ENV !== "development" && !warnedStripeStubEntitlementsOutsideDev) {
      warnedStripeStubEntitlementsOutsideDev = true;
      logger.warn(
        "ALLOW_STRIPE_STUB_ENTITLEMENTS=1 is set: STRIPE_STUB_PLAN overlays apply outside NODE_ENV development. " +
          "Limit this to trusted local tooling, not internet-facing APIs.",
      );
    }
    return true;
  }
  return process.env.NODE_ENV === "development";
}

function stripeStubInheritanceAddonFromEnv(): boolean {
  const raw = process.env.STRIPE_STUB_INHERITANCE_ADDON?.trim().toLowerCase();
  if (!raw) return false;
  if (raw === "1" || raw === "true" || raw === "on" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") return false;
  return false;
}

export type StripeStubPlanResolutionMode = "toggle_first" | "env_first";

/**
 * How `STRIPE_STUB_PLAN` interacts with SPA `X-Stub-Billing-Plan`:
 * - `toggle_first` (default): SPA strip wins when middleware attaches a billing overlay (trusted dev headers). Env applies only when that overlay is absent.
 * - `env_first` (`force_env`): env overlay wins whenever `STRIPE_STUB_PLAN` is active; SPA strip cannot change entitlement for API calls (UI may still simulate).
 */
export function stripeStubPlanResolutionMode(): StripeStubPlanResolutionMode {
  const raw = process.env.STRIPE_STUB_PLAN_RESOLUTION?.trim().toLowerCase();
  if (!raw || raw === "toggle_first" || raw === "spa_first" || raw === "strip_first") return "toggle_first";
  if (raw === "env_first" || raw === "force_env") return "env_first";
  return "toggle_first";
}

/**
 * Reads `STRIPE_STUB_PLAN` / `STRIPE_STUB_INHERITANCE_ADDON` when trusted (see {@link shouldTrustStripeStubEntitlementsFromEnv}),
 * Merge into `resolveUserEntitlements` per {@link stripeStubPlanResolutionMode}.
 *
 * Empty `STRIPE_STUB_PLAN` means no env overlay (use DB or SPA stub headers).
 */
export function currentStripeStubEntitlementsOverlay(): {
  planSlug: AuthStubResolvedPlanSlug;
  inheritanceAddon: boolean;
} | null {
  if (!shouldTrustStripeStubEntitlementsFromEnv()) return null;
  const raw = process.env.STRIPE_STUB_PLAN?.trim();
  if (!raw) return null;
  const planSlug = mapBillingStubPlanTokenToSlug(raw);
  if (planSlug === null) return null;
  return { planSlug, inheritanceAddon: stripeStubInheritanceAddonFromEnv() };
}
