import { Router, type IRouter } from "express";
import Stripe from "stripe";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, billingSubscriptionsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import { publicAppBaseUrl } from "../lib/emailDelivery";

const router: IRouter = Router();

const CheckoutSessionBody = z
  .object({
    plan: z.enum(["everyday_plus", "professional"]).default("everyday_plus"),
    /** Customer-facing Stripe promotion code (Everyday or Professional checkout). */
    promotionCode: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

type CheckoutPromotionResult =
  | { ok: true; promotionCodeId: string }
  | { ok: false; error: string };

async function resolveCheckoutPromotionCode(
  stripe: Stripe,
  code: string,
  priceId: string,
): Promise<CheckoutPromotionResult> {
  const trimmed = code.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a discount code or leave the field blank." };
  }

  const list = await stripe.promotionCodes.list({ code: trimmed, active: true, limit: 1 });
  const promo = list.data[0];
  if (!promo) {
    return { ok: false, error: "That discount code is not valid or has expired." };
  }
  if (promo.expires_at != null && promo.expires_at * 1000 < Date.now()) {
    return { ok: false, error: "That discount code has expired." };
  }
  if (promo.max_redemptions != null && promo.times_redeemed >= promo.max_redemptions) {
    return { ok: false, error: "That discount code has reached its redemption limit." };
  }

  const price = await stripe.prices.retrieve(priceId);
  const productId = typeof price.product === "string" ? price.product : price.product?.id;
  const couponId = typeof promo.coupon === "string" ? promo.coupon : promo.coupon.id;
  const coupon = await stripe.coupons.retrieve(couponId);
  const restrictedProducts = coupon.applies_to?.products;
  if (restrictedProducts?.length) {
    if (!productId || !restrictedProducts.includes(productId)) {
      return { ok: false, error: "That discount code does not apply to the selected plan." };
    }
  }

  return { ok: true, promotionCodeId: promo.id };
}

function billingBaseUrl(): string {
  return publicAppBaseUrl();
}

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

function stripePlanPriceIds(): {
  everyday: string | undefined;
  professional: string | undefined;
  legacyPro: string | undefined;
} {
  return {
    everyday: process.env.STRIPE_PRICE_EVERYDAY_PLUS?.trim(),
    professional: process.env.STRIPE_PRICE_PROFESSIONAL?.trim(),
    legacyPro: process.env.STRIPE_PRICE_PRO?.trim(),
  };
}

function resolvePlanPriceId(
  plan: "everyday_plus" | "professional",
  prices: ReturnType<typeof stripePlanPriceIds>,
): string | undefined {
  return plan === "professional"
    ? prices.professional ?? prices.legacyPro
    : prices.everyday ?? prices.legacyPro;
}

function stripeCheckoutConfigError(
  plan: "everyday_plus" | "professional",
  prices: ReturnType<typeof stripePlanPriceIds>,
): string | null {
  const missing: string[] = [];
  if (!getStripe()) missing.push("STRIPE_SECRET_KEY");

  const priceId = resolvePlanPriceId(plan, prices);
  if (!priceId) {
    if (plan === "professional") {
      if (!prices.professional && !prices.legacyPro) {
        missing.push("STRIPE_PRICE_PROFESSIONAL (or legacy STRIPE_PRICE_PRO)");
      }
    } else if (!prices.everyday && !prices.legacyPro) {
      missing.push("STRIPE_PRICE_EVERYDAY_PLUS (or legacy STRIPE_PRICE_PRO)");
    }
  }

  if (missing.length === 0) return null;
  return `Stripe billing is not configured. Missing: ${missing.join(", ")}. Add them to the repo root .env and restart the API server.`;
}

function parseTrialDaysProfessional(): number | undefined {
  const raw = process.env.STRIPE_PROFESSIONAL_TRIAL_DAYS?.trim();
  if (!raw) return 14;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n);
}

router.post("/billing/checkout-session", requireAuth, async (req, res): Promise<void> => {
  const baseUrl = billingBaseUrl();
  const stripe = getStripe();

  const body = CheckoutSessionBody.safeParse(typeof req.body === "object" && req.body !== null ? req.body : {});
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const prices = stripePlanPriceIds();
  const primaryPrice = resolvePlanPriceId(body.data.plan, prices);

  const configError = stripeCheckoutConfigError(body.data.plan, prices);
  if (configError || !stripe || !primaryPrice) {
    res.status(503).json({ error: configError ?? "Stripe billing is not configured." });
    return;
  }

  const userId = (req as AuthedRequest).userId!;
  const [existing] = await db
    .select()
    .from(billingSubscriptionsTable)
    .where(eq(billingSubscriptionsTable.userId, userId));

  let customerId = existing?.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { clerkUserId: userId },
    });
    customerId = customer.id;
    await db
      .insert(billingSubscriptionsTable)
      .values({
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: null,
        stripeInheritanceSubscriptionId: null,
        status: "inactive",
        tier: "free",
        planSlug: null,
        hasInheritanceAddon: false,
      })
      .onConflictDoUpdate({
        target: billingSubscriptionsTable.userId,
        set: { stripeCustomerId: customerId, updatedAt: new Date() },
      });
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{ price: primaryPrice, quantity: 1 }];

  const planSlugMeta = body.data.plan === "professional" ? "professional" : "everyday_plus";
  const trialDays =
    body.data.plan === "professional" ? parseTrialDaysProfessional() : undefined;

  const promotionCodeRaw = body.data.promotionCode?.trim();
  let checkoutDiscounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
  let allowPromotionCodes = true;
  if (promotionCodeRaw) {
    try {
      const resolved = await resolveCheckoutPromotionCode(stripe, promotionCodeRaw, primaryPrice);
      if (!resolved.ok) {
        res.status(400).json({ error: resolved.error });
        return;
      }
      checkoutDiscounts = [{ promotion_code: resolved.promotionCodeId }];
      allowPromotionCodes = false;
    } catch (err) {
      logger.error({ err, plan: body.data.plan }, "Stripe promotion code lookup failed");
      res.status(502).json({ error: "Could not validate that discount code. Try again shortly." });
      return;
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: lineItems,
      success_url: `${baseUrl.replace(/\/$/, "")}/settings?checkout=success`,
      cancel_url: `${baseUrl.replace(/\/$/, "")}/settings?checkout=cancel`,
      metadata: { clerkUserId: userId, planSlug: planSlugMeta },
      subscription_data: {
        metadata: { clerkUserId: userId, planSlug: planSlugMeta },
        ...(trialDays != null ? { trial_period_days: trialDays } : {}),
      },
      ...(checkoutDiscounts ? { discounts: checkoutDiscounts } : { allow_promotion_codes: allowPromotionCodes }),
    });
    if (!session.url) {
      res.status(502).json({ error: "Stripe did not return a checkout URL." });
      return;
    }
    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "Stripe checkout session failed");
    res.status(502).json({ error: "Could not start checkout. Try again shortly." });
  }
});

router.post("/billing/checkout-session-inheritance-addon", requireAuth, async (req, res): Promise<void> => {
  const baseUrl = billingBaseUrl();
  const stripe = getStripe();
  const inh = process.env.STRIPE_PRICE_INHERITANCE_ADDON?.trim();

  if (!stripe || !inh) {
    res.status(503).json({
      error:
        "Inheritance Stripe price is missing. Configure STRIPE_PRICE_INHERITANCE_ADDON alongside Stripe keys.",
    });
    return;
  }

  const userId = (req as AuthedRequest).userId!;
  const [existing] = await db
    .select()
    .from(billingSubscriptionsTable)
    .where(eq(billingSubscriptionsTable.userId, userId));

  let customerId = existing?.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { clerkUserId: userId },
    });
    customerId = customer.id;
    await db
      .insert(billingSubscriptionsTable)
      .values({
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: null,
        stripeInheritanceSubscriptionId: null,
        status: "inactive",
        tier: "free",
        planSlug: null,
        hasInheritanceAddon: false,
      })
      .onConflictDoUpdate({
        target: billingSubscriptionsTable.userId,
        set: { stripeCustomerId: customerId, updatedAt: new Date() },
      });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: inh, quantity: 1 }],
      success_url: `${baseUrl.replace(/\/$/, "")}/settings?checkout=success`,
      cancel_url: `${baseUrl.replace(/\/$/, "")}/settings?checkout=cancel`,
      metadata: { clerkUserId: userId, checkoutKind: "inheritance_addon", planSlug: "inheritance_addon" },
      subscription_data: {
        metadata: { clerkUserId: userId, checkoutKind: "inheritance_addon", planSlug: "inheritance_addon" },
      },
    });
    if (!session.url) {
      res.status(502).json({ error: "Stripe did not return a checkout URL." });
      return;
    }
    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "Stripe inheritance checkout session failed");
    res.status(502).json({ error: "Could not start inheritance checkout. Try again shortly." });
  }
});

router.post("/billing/customer-portal", requireAuth, async (req, res): Promise<void> => {
  const baseUrl = billingBaseUrl();
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: "Stripe is not configured." });
    return;
  }

  const userId = (req as AuthedRequest).userId!;
  const [existing] = await db
    .select()
    .from(billingSubscriptionsTable)
    .where(eq(billingSubscriptionsTable.userId, userId));

  if (!existing?.stripeCustomerId) {
    res.status(400).json({ error: "No billing profile yet. Subscribe via Checkout first." });
    return;
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: existing.stripeCustomerId,
      return_url: `${baseUrl.replace(/\/$/, "")}/settings`,
    });
    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "Stripe customer portal failed");
    res.status(502).json({ error: "Could not open billing portal." });
  }
});

export default router;
