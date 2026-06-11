import type { Request, Response } from "express";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, billingSubscriptionsTable } from "@workspace/db";
import {
  notifyBillingRenewalUpcoming,
  notifyBillingSubscriptionConfirmed,
} from "./lib/billingRenewalEmail";
import { logger } from "./lib/logger";
import {
  classifyInheritanceAddonPrice,
  classifyStripePriceId,
} from "./lib/entitlements";

const ACTIVE = new Set(["active", "trialing", "past_due"]);

function priceIdOf(it: Stripe.SubscriptionItem): string | undefined {
  return typeof it.price === "object" ? it.price?.id : undefined;
}

function summarizeStripeLineItems(items: Stripe.SubscriptionItem[]): {
  planSlug: "everyday_plus" | "professional" | null;
  hasInheritancePrice: boolean;
  hasValuationPlanPrice: boolean;
} {
  let hasProfessional = false;
  let hasEveryday = false;
  let hasInheritancePrice = false;

  for (const it of items) {
    const pid = priceIdOf(it);
    if (!pid) continue;
    if (classifyInheritanceAddonPrice(pid)) {
      hasInheritancePrice = true;
      continue;
    }
    const tag = classifyStripePriceId(pid);
    if (!tag) continue;
    if (tag === "professional") hasProfessional = true;
    if (tag === "everyday_plus") hasEveryday = true;
  }

  const planSlug: "everyday_plus" | "professional" | null = hasProfessional
    ? "professional"
    : hasEveryday
      ? "everyday_plus"
      : null;

  return {
    planSlug,
    hasInheritancePrice,
    hasValuationPlanPrice: hasProfessional || hasEveryday,
  };
}

async function resolveUserIdFromCustomer(customerId: string | undefined): Promise<string | undefined> {
  if (!customerId) return undefined;
  const [row] = await db
    .select({ userId: billingSubscriptionsTable.userId })
    .from(billingSubscriptionsTable)
    .where(eq(billingSubscriptionsTable.stripeCustomerId, customerId));
  return row?.userId;
}

type BillingRow = typeof billingSubscriptionsTable.$inferSelect;

async function selectBillingRow(userId: string): Promise<BillingRow | null> {
  const [row] = await db.select().from(billingSubscriptionsTable).where(eq(billingSubscriptionsTable.userId, userId));
  return row ?? null;
}

function mergeStripeSubscriptionIntoRow(params: {
  existing: BillingRow | null;
  userId: string;
  stripeCustomerId: string;
  sub: Stripe.Subscription;
}): typeof billingSubscriptionsTable.$inferInsert {
  const { existing, userId, stripeCustomerId, sub } = params;
  const items = sub.items?.data ?? [];
  const summarized = summarizeStripeLineItems(items);
  const active = ACTIVE.has(sub.status);

  const standaloneInheritance =
    summarized.hasInheritancePrice && !summarized.hasValuationPlanPrice;

  if (standaloneInheritance) {
    return {
      userId,
      stripeCustomerId,
      stripeSubscriptionId: existing?.stripeSubscriptionId ?? null,
      stripeInheritanceSubscriptionId: active ? sub.id : null,
      status: existing?.status ?? "inactive",
      tier: existing?.tier ?? "free",
      planSlug: existing?.planSlug ?? null,
      hasInheritanceAddon: Boolean(active && summarized.hasInheritancePrice),
      updatedAt: new Date(),
    };
  }

  const valuationActive = summarized.hasValuationPlanPrice && active;
  let hasInheritanceAddon = existing?.hasInheritanceAddon ?? false;
  if (summarized.hasInheritancePrice) {
    /** Bundled inheritance line on the valuation subscription (same Stripe object). */
    hasInheritanceAddon = active && summarized.hasInheritancePrice;
  }

  const tierDerived: "free" | "pro" = valuationActive ? "pro" : "free";
  const planSlug = valuationActive ? summarized.planSlug : null;

  return {
    userId,
    stripeCustomerId,
    stripeSubscriptionId: sub.id,
    stripeInheritanceSubscriptionId: existing?.stripeInheritanceSubscriptionId ?? null,
    status: sub.status,
    tier: tierDerived,
    planSlug,
    hasInheritanceAddon,
    updatedAt: new Date(),
  };
}

async function applyStripeSubscription(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  let userId: string | undefined =
    typeof sub.metadata?.clerkUserId === "string" ? sub.metadata.clerkUserId : undefined;
  if (!userId && customerId) userId = await resolveUserIdFromCustomer(customerId);
  if (!userId || !customerId) {
    logger.warn({ subId: sub.id }, "Stripe subscription skipped: unknown user linkage");
    return;
  }

  const existing = await selectBillingRow(userId);
  const merged = mergeStripeSubscriptionIntoRow({ existing, userId, stripeCustomerId: customerId, sub });

  await db
    .insert(billingSubscriptionsTable)
    .values(merged)
    .onConflictDoUpdate({
      target: billingSubscriptionsTable.userId,
      set: {
        stripeCustomerId: merged.stripeCustomerId,
        stripeSubscriptionId: merged.stripeSubscriptionId,
        stripeInheritanceSubscriptionId: merged.stripeInheritanceSubscriptionId,
        status: merged.status,
        tier: merged.tier,
        planSlug: merged.planSlug,
        hasInheritanceAddon: merged.hasInheritanceAddon,
        updatedAt: new Date(),
      },
    });

  logger.info(
    { userId, subStatus: sub.status, planSlug: merged.planSlug, inh: merged.hasInheritanceAddon },
    "billingSubscriptions synced",
  );
}

async function hydrateSubscription(client: Stripe, subId: string): Promise<Stripe.Subscription> {
  return client.subscriptions.retrieve(subId, { expand: ["items.data.price"] });
}

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!secret || !stripeKey) {
    res.status(503).send("Webhook not configured");
    return;
  }

  const stripe = new Stripe(stripeKey);
  const sig = req.headers["stripe-signature"];
  if (typeof sig !== "string") {
    res.status(400).send("Missing stripe-signature");
    return;
  }

  if (!Buffer.isBuffer(req.body)) {
    res.status(400).send("Expected raw body");
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    logger.warn({ err }, "Stripe webhook signature verification failed");
    res.status(400).send("Webhook Error");
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.clerkUserId;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subIdRaw = session.subscription;
        const subId = typeof subIdRaw === "string" ? subIdRaw : subIdRaw?.id;
        if (!userId || !customerId) break;
        if (session.metadata?.checkoutKind === "inheritance_addon" && subId) {
          try {
            const full = await hydrateSubscription(stripe, subId);
            await applyStripeSubscription(full);
            await notifyBillingSubscriptionConfirmed(userId, full);
          } catch (err) {
            logger.error({ err, subId }, "inheritance checkout hydrate failed");
            const existing = await selectBillingRow(userId);
            await db
              .insert(billingSubscriptionsTable)
              .values({
                userId,
                stripeCustomerId: customerId,
                stripeSubscriptionId: existing?.stripeSubscriptionId ?? null,
                stripeInheritanceSubscriptionId: subId ?? null,
                status: existing?.status ?? "inactive",
                tier: existing?.tier ?? "free",
                planSlug: existing?.planSlug ?? null,
                hasInheritanceAddon: true,
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: billingSubscriptionsTable.userId,
                set: {
                  stripeCustomerId: customerId,
                  stripeInheritanceSubscriptionId: subId ?? null,
                  hasInheritanceAddon: true,
                  updatedAt: new Date(),
                },
              });
          }
          break;
        }
        if (subId) {
          try {
            const full = await hydrateSubscription(stripe, subId);
            await applyStripeSubscription(full);
            await notifyBillingSubscriptionConfirmed(userId, full);
          } catch (err) {
            logger.error({ err, subId }, "Could not hydrate subscription after checkout");
            const existing = await selectBillingRow(userId);
            const planSlugGuess =
              session.metadata?.planSlug === "professional" ? "professional" : "everyday_plus";
            await db
              .insert(billingSubscriptionsTable)
              .values({
                userId,
                stripeCustomerId: customerId,
                stripeSubscriptionId: subId ?? null,
                stripeInheritanceSubscriptionId: existing?.stripeInheritanceSubscriptionId ?? null,
                status: "active",
                tier: "pro",
                planSlug: planSlugGuess,
                hasInheritanceAddon: existing?.hasInheritanceAddon ?? false,
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: billingSubscriptionsTable.userId,
                set: {
                  stripeCustomerId: customerId,
                  stripeSubscriptionId: subId ?? null,
                  status: "active",
                  tier: "pro",
                  planSlug: planSlugGuess,
                  updatedAt: new Date(),
                },
              });
          }
        }
        break;
      }
      case "invoice.upcoming": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        const userId = await resolveUserIdFromCustomer(customerId);
        if (!userId) break;
        try {
          await notifyBillingRenewalUpcoming(userId, invoice);
        } catch (err) {
          logger.error({ err, invoiceId: invoice.id, userId }, "Renewal notice handler failed");
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        try {
          const full =
            sub.items?.data?.[0]?.price == null ? await hydrateSubscription(stripe, sub.id) : sub;
          await applyStripeSubscription(full);
        } catch (err) {
          logger.error({ err }, "subscription sync failed");
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    logger.error({ err, type: event.type }, "Stripe webhook handler error");
    res.status(500).send("handler error");
    return;
  }

  res.json({ received: true });
}
