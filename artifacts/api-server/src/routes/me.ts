import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, estimatesTable, listingsTable, billingSubscriptionsTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { isAuthStubMode } from "../lib/authStub";
import { getUserAlertPrefs, upsertUserAlertPrefs } from "../lib/userAlertPrefs";
import {
  isEmailDeliveryConfigured,
  publicAppBaseUrl,
  sendHtmlEmail,
} from "../lib/emailDelivery";
import {
  buildConnectivityTestEmailHtml,
  emailAlertDevToolsEnabled,
  resolveEmailAlertRecipient,
  sampleEstimateReadyEmail,
  sampleMonitorValueEmail,
  type EmailAlertSampleKind,
} from "../lib/emailAlertSamples";
import { runMonitorValueChangeScan } from "../lib/monitorValueChangeEmail";
import { resolveUserEntitlements } from "../lib/entitlements";
import { isAdminUserId } from "../lib/adminAccess";
import { sanitizeListingDraftTitle, stripSellerTodoBlockFromDraftBody } from "../lib/listing";

const router: IRouter = Router();

const PatchEmailAlertsBody = z
  .object({
    estimateReadyEmail: z.boolean().optional(),
    productUpdatesEmail: z.boolean().optional(),
    monitorValueChangeEmail: z.boolean().optional(),
  })
  .strict()
  .refine(
    (o) =>
      o.estimateReadyEmail !== undefined ||
      o.productUpdatesEmail !== undefined ||
      o.monitorValueChangeEmail !== undefined,
    {
      message: "Provide at least one of estimateReadyEmail, productUpdatesEmail, monitorValueChangeEmail",
    },
  );

const TestEmailBody = z
  .object({
    kind: z.enum(["connectivity", "estimate_ready", "monitor_value"]).default("connectivity"),
    to: z.string().email().optional(),
  })
  .strict();

const RunMonitorScanBody = z
  .object({
    /** Dev only: alert on any monitor-intent row regardless of uplift threshold. */
    force: z.boolean().optional(),
  })
  .strict();

router.get("/me/email-alerts", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const prefs = await getUserAlertPrefs(userId);
  res.json({
    ...prefs,
    deliveryEnabled: isEmailDeliveryConfigured(),
    devToolsEnabled: emailAlertDevToolsEnabled(),
  });
});

router.patch("/me/email-alerts", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const parsed = PatchEmailAlertsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((e) => e.message).join("; ") });
    return;
  }

  const current = await getUserAlertPrefs(userId);
  const next = {
    estimateReadyEmail: parsed.data.estimateReadyEmail ?? current.estimateReadyEmail,
    productUpdatesEmail: parsed.data.productUpdatesEmail ?? current.productUpdatesEmail,
    monitorValueChangeEmail: parsed.data.monitorValueChangeEmail ?? current.monitorValueChangeEmail,
  };
  const wantsAnyEmailToggleOn =
    next.estimateReadyEmail || next.productUpdatesEmail || next.monitorValueChangeEmail;
  if (wantsAnyEmailToggleOn) {
    const ent = await resolveUserEntitlements(userId, req);
    if (!ent.hasPaidValuationTier) {
      res.status(403).json({
        error:
          "Email-powered alerts stay off on Free. Upgrade via Settings to enable estimate-ready pings, monitors, or product emails.",
      });
      return;
    }
  }

  const persisted = await upsertUserAlertPrefs(userId, parsed.data);
  res.json({
    ...persisted,
    deliveryEnabled: isEmailDeliveryConfigured(),
    devToolsEnabled: emailAlertDevToolsEnabled(),
  });
});

router.post("/me/email-alerts/test", requireAuth, async (req, res): Promise<void> => {
  if (!isEmailDeliveryConfigured()) {
    res.status(503).json({
      error:
        "Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM on the API server.",
    });
    return;
  }
  const parsed = TestEmailBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((e) => e.message).join("; ") });
    return;
  }
  const userId = (req as AuthedRequest).userId!;
  const recipient = await resolveEmailAlertRecipient(userId, parsed.data.to);
  if ("error" in recipient) {
    res.status(400).json({ error: recipient.error });
    return;
  }

  const kind: EmailAlertSampleKind = parsed.data.kind;
  const base = publicAppBaseUrl().replace(/\/$/, "");
  let subject: string;
  let html: string;
  if (kind === "estimate_ready") {
    ({ subject, html } = sampleEstimateReadyEmail());
  } else if (kind === "monitor_value") {
    ({ subject, html } = sampleMonitorValueEmail());
  } else {
    subject = "ValYoued email alerts test";
    html = buildConnectivityTestEmailHtml(base);
  }

  const sent = await sendHtmlEmail({ to: recipient.to, subject, html });
  if (!sent.ok) {
    res.status(502).json({ error: sent.error });
    return;
  }
  res.json({ ok: true, kind, to: recipient.to });
});

/** Dev-only: run the monitor scan against your saved valuations (same logic as opening Portfolio alerts). */
router.post("/me/email-alerts/run-monitor-scan", requireAuth, async (req, res): Promise<void> => {
  if (!emailAlertDevToolsEnabled()) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = RunMonitorScanBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((e) => e.message).join("; ") });
    return;
  }
  const userId = (req as AuthedRequest).userId!;
  const ent = await resolveUserEntitlements(userId, req);
  if (!ent.canUseMonitorEmailAlerts) {
    res.status(403).json({
      error: "Monitor email alerts require Everyday or Professional with the portfolio monitor toggle enabled.",
    });
    return;
  }
  const prefs = await getUserAlertPrefs(userId);
  if (!prefs.monitorValueChangeEmail) {
    res.status(400).json({
      error: "Turn on Portfolio value-change monitors in email alerts first.",
    });
    return;
  }
  const force = Boolean(parsed.data.force);
  const result = await runMonitorValueChangeScan(userId, {
    minUplift: force ? 0 : 0.03,
    skipDedup: force,
  });
  res.json({
    ok: true,
    force,
    ...result,
    hint:
      result.emailedCount === 0 && result.monitoredCount === 0
        ? "Tag at least one valuation intent as Monitor, then retry."
        : result.emailedCount === 0 && !force
          ? "No rows met the 3% uplift threshold. Retry with { \"force\": true } or use Send sample monitor email."
          : undefined,
  });
});

router.get("/me/billing", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  const ent = await resolveUserEntitlements(userId, req);
  if (isAuthStubMode()) {
    res.json({
      tier: ent.tier,
      status: ent.hasPaidValuationTier ? "stub_active" : "inactive",
      stripeCustomerId: null,
      planSlug: ent.planSlug === "none" ? "none" : ent.planSlug,
      hasInheritanceAddon: Boolean(ent.hasInheritanceAddon),
      valuationsThisMonth: ent.valuationsThisMonth,
      valuationsMonthLimit: ent.valuationsMonthLimit,
      valuationsRemainingFree: ent.valuationsRemainingFree,
      hasPaidValuationTier: ent.hasPaidValuationTier,
      canUsePortfolioAnalytics: ent.canUsePortfolioAnalytics,
      canUseTraderWorkspace: ent.canUseTraderWorkspace,
      comparableUiMode: ent.hasPaidValuationTier ? ("full" as const) : ("preview" as const),
    });
    return;
  }

  const [sub] = await db
    .select()
    .from(billingSubscriptionsTable)
    .where(eq(billingSubscriptionsTable.userId, userId));
  res.json({
    tier: ent.tier,
    status: ent.subscriptionStatus,
    stripeCustomerId: sub?.stripeCustomerId ?? null,
    planSlug: ent.planSlug === "none" ? "none" : ent.planSlug,
    hasInheritanceAddon: Boolean(ent.hasInheritanceAddon),
    valuationsThisMonth: ent.valuationsThisMonth,
    valuationsMonthLimit: ent.valuationsMonthLimit,
    valuationsRemainingFree: ent.valuationsRemainingFree,
    hasPaidValuationTier: ent.hasPaidValuationTier,
    canUsePortfolioAnalytics: ent.canUsePortfolioAnalytics,
    canUseTraderWorkspace: ent.canUseTraderWorkspace,
    comparableUiMode: ent.hasPaidValuationTier ? ("full" as const) : ("preview" as const),
  });
});

router.get("/me/admin", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;
  res.json({ isAdmin: isAdminUserId(userId) });
});

/** GDPR-oriented bundle of the authenticated user's platform data (JSON). */
router.get("/me/data-export", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId!;

  const estimates = await db
    .select()
    .from(estimatesTable)
    .where(eq(estimatesTable.userId, userId))
    .orderBy(desc(estimatesTable.createdAt));

  const listings = await db
    .select()
    .from(listingsTable)
    .where(eq(listingsTable.userId, userId))
    .orderBy(desc(listingsTable.createdAt));

  const emailAlertPreferences = await getUserAlertPrefs(userId);

  res.json({
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    userId,
    estimates: estimates.map((r) => ({
      id: r.id,
      assetTypeId: r.assetTypeId,
      assetTypeName: r.assetTypeName,
      title: r.title,
      currency: r.currency,
      baselineMid: r.baselineMid,
      adjustedMid: r.adjustedMid,
      bestArbitrageRegion: r.bestArbitrageRegion,
      tier: r.tier,
      portfolioId: r.portfolioId,
      intent: r.intent,
      lineage: r.lineage,
      outcomeSoldPrice: r.outcomeSoldPrice ?? null,
      outcomeCurrency: r.outcomeCurrency ?? null,
      outcomeRecordedAt: r.outcomeRecordedAt?.toISOString() ?? null,
      feedbackHelpful: r.feedbackHelpful ?? null,
      feedbackRecordedAt: r.feedbackRecordedAt?.toISOString() ?? null,
      result: r.result,
      createdAt: r.createdAt.toISOString(),
    })),
    listings: listings.map((r) => ({
      id: r.id,
      estimateId: r.estimateId,
      platform: r.platform,
      assetTitle: r.assetTitle,
      assetTypeName: r.assetTypeName,
      draftTitle: sanitizeListingDraftTitle(r.draftTitle),
      draftBody: stripSellerTodoBlockFromDraftBody(r.draftBody),
      suggestedPrice: r.suggestedPrice,
      currency: r.currency,
      photoTips: r.photoTips,
      hashtags: r.hashtags,
      proTips: r.proTips,
      createdAt: r.createdAt.toISOString(),
    })),
    emailAlertPreferences,
    privacyNote:
      "This export contains valuation inputs and outputs you generated on ValYoued. Account credentials are managed by Clerk; delete your account from Profile / Clerk where applicable.",
  });
});

export default router;
