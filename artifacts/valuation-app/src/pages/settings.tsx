import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuthStubContext } from "@/context/AuthStubContext";
import { useAuth, useClerk } from "@clerk/react";
import {
  ArrowLeft,
  CreditCard,
  Download,
  ExternalLink,
  Globe2,
  Mail,
  Shield,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { DISPLAY_CURRENCY_OPTIONS, getStoredReferenceCurrency, getSessionGeoCountry, countryCodeToDisplayCurrency } from "@/lib/reference-currency";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiFetchCredentials, apiUrl } from "@/lib/api-url";
import { planTierDisplayName } from "@/lib/marketing-plan-tiers";
import { useQueryClient } from "@tanstack/react-query";
import { useBillingSummary } from "@/hooks/use-billing-summary";
import { PageTitle } from "@/components/layout/PageTitle";

type EmailAlertsInfo = {
  estimateReadyEmail: boolean;
  productUpdatesEmail: boolean;
  monitorValueChangeEmail?: boolean;
  deliveryEnabled: boolean;
  devToolsEnabled?: boolean;
};

type EmailTestKind = "connectivity" | "estimate_ready" | "monitor_value";

type BillingActionJson = { url?: string; error?: string; priceId?: string; stub?: boolean };

/** Blob downloads: anchor must be in the document; revoking the object URL immediately can cancel the save. */
function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

/** Many proxies and Express defaults return an empty body on 500; `res.json()` then throws. */
async function parseBillingJsonBody(res: Response): Promise<{ ok: true; body: BillingActionJson } | { ok: false; error: string }> {
  let raw = "";
  try {
    raw = await res.text();
  } catch {
    return {
      ok: false,
      error:
        `${res.status} ${res.statusText}`.trim() ||
        (!res.ok ? "Could not read error response body" : "Could not read response body"),
    };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    if (!res.ok) {
      const fallback = `${res.status} ${res.statusText}`.trim();
      return { ok: false, error: fallback || "Empty error response from server" };
    }
    return { ok: true, body: {} };
  }

  try {
    return { ok: true, body: JSON.parse(trimmed) as BillingActionJson };
  } catch {
    const hint = trimmed.length > 220 ? `${trimmed.slice(0, 219)}…` : trimmed;
    return {
      ok: false,
      error:
        `${res.status} ${res.statusText}`.trim() +
        (hint ? `: ${hint}` : ""),
    };
  }
}

async function postBilling(
  path: string,
  getToken: () => Promise<string | null | undefined>,
  jsonBody: Record<string, unknown> = {},
): Promise<{ url?: string; error?: string }> {
  const token = await getToken();
  const res = await fetch(apiUrl(`/api/billing/${path}`), {
    method: "POST",
    credentials: apiFetchCredentials(),
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(jsonBody),
  });

  const parsed = await parseBillingJsonBody(res);
  if (!parsed.ok) return { error: parsed.error };

  const data = parsed.body;
  if (!res.ok) {
    const code = `${res.status} ${res.statusText}`.trim();
    const priceHint =
      typeof data.priceId === "string" && data.priceId.trim()
        ? ` (price: ${data.priceId.trim()})`
        : "";
    return { error: (data.error ?? code ?? "Billing request failed") + priceHint };
  }

  return data;
}

function SettingsPageInner({
  getToken,
  onOpenProfile,
  authStub,
}: {
  getToken: () => Promise<string | null | undefined>;
  onOpenProfile?: () => void;
  authStub?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { code: displayCurrencyCode, setCode: setDisplayCurrency } = useDisplayCurrency();
  const geoCountry = (() => {
    try {
      return getSessionGeoCountry();
    } catch {
      return null;
    }
  })();
  const geoLedToCurrency =
    Boolean(geoCountry) && countryCodeToDisplayCurrency(geoCountry) === displayCurrencyCode;
  const { data: billing, isLoading: billingLoading } = useBillingSummary();
  const [emailAlerts, setEmailAlerts] = useState<EmailAlertsInfo | null>(null);
  const [stubTestEmail, setStubTestEmail] = useState(
    () => localStorage.getItem("valyoued.stub-test-email") ?? "",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<"everyday_plus" | "professional">("everyday_plus");
  const [discountCode, setDiscountCode] = useState("");

  const refreshEmailAlerts = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(apiUrl("/api/me/email-alerts"), {
        credentials: apiFetchCredentials(),
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const raw = await res.text();
      const trimmed = raw.trim();
      if (!trimmed) return;
      try {
        const j = JSON.parse(trimmed) as EmailAlertsInfo;
        setEmailAlerts(j);
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore */
    }
  }, [getToken]);

  useEffect(() => {
    void refreshEmailAlerts();
  }, [refreshEmailAlerts]);

  const patchEmailAlert = async (
    patch: Partial<
      Pick<EmailAlertsInfo, "estimateReadyEmail" | "productUpdatesEmail" | "monitorValueChangeEmail">
    >,
  ) => {
    try {
      const token = await getToken();
      const res = await fetch(apiUrl("/api/me/email-alerts"), {
        method: "PATCH",
        credentials: apiFetchCredentials(),
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(patch),
      });
      const raw = await res.text();
      if (!res.ok) {
        toast({
          title: "Could not save email preferences",
          description: raw.trim() || `${res.status}`,
          variant: "destructive",
        });
        return;
      }
      try {
        const j = JSON.parse(raw) as EmailAlertsInfo;
        setEmailAlerts(j);
        queryClient.invalidateQueries({ queryKey: ["me-billing"] });
      } catch {
        void refreshEmailAlerts();
      }
    } catch {
      toast({
        title: "Could not save email preferences",
        description: "Network error.",
        variant: "destructive",
      });
    }
  };

  const sendTestEmail = async (kind: EmailTestKind = "connectivity") => {
    setBusy(`email-test:${kind}`);
    try {
      const token = await getToken();
      const payload: { kind: EmailTestKind; to?: string } = { kind };
      const to = stubTestEmail.trim();
      if (to) payload.to = to;
      const res = await fetch(apiUrl("/api/me/email-alerts/test"), {
        method: "POST",
        credentials: apiFetchCredentials(),
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const text = (await res.text()).trim();
      if (!res.ok) {
        let msg = text;
        try {
          const j = JSON.parse(text) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* use raw */
        }
        toast({ title: "Test email failed", description: msg, variant: "destructive" });
        return;
      }
      const label =
        kind === "connectivity"
          ? "Connection test"
          : kind === "estimate_ready"
            ? "Sample estimate-ready email"
            : "Sample monitor alert";
      toast({ title: `${label} sent`, description: "Check your inbox (and spam) in a few seconds." });
    } finally {
      setBusy(null);
    }
  };

  const runMonitorScan = async (force: boolean) => {
    setBusy(force ? "monitor-scan-force" : "monitor-scan");
    try {
      const token = await getToken();
      const res = await fetch(apiUrl("/api/me/email-alerts/run-monitor-scan"), {
        method: "POST",
        credentials: apiFetchCredentials(),
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ force }),
      });
      const text = (await res.text()).trim();
      if (!res.ok) {
        let msg = text;
        try {
          const j = JSON.parse(text) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* use raw */
        }
        toast({ title: "Monitor scan failed", description: msg, variant: "destructive" });
        return;
      }
      const j = JSON.parse(text) as {
        monitoredCount?: number;
        emailedCount?: number;
        notifiedCount?: number;
        hint?: string;
      };
      toast({
        title: force ? "Forced monitor scan complete" : "Monitor scan complete",
        description:
          j.hint ??
          `${j.emailedCount ?? 0} email(s) sent, ${j.notifiedCount ?? 0} in-app alert(s) from ${j.monitoredCount ?? 0} monitored item(s).`,
      });
    } finally {
      setBusy(null);
    }
  };

  /** Deep link from `/settings#inheritance-addon` once billing section has rendered. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.location.hash.replace(/^#/, "");
    if (id !== "inheritance-addon") return;
    const run = () => {
      document.getElementById("inheritance-addon")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    const t = window.setTimeout(run, 150);
    return () => window.clearTimeout(t);
  }, [billing]);

  const exportData = async () => {
    setBusy("export");
    try {
      const token = await getToken();
      const res = await fetch(apiUrl("/api/me/data-export"), {
        credentials: apiFetchCredentials(),
        headers: {
          accept: "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      });

      const bodyText = await res.text();
      if (!res.ok) {
        let detail = bodyText.trim();
        if (!detail) detail = `${res.status} ${res.statusText}`.trim() || "Request failed.";
        try {
          const parsed = JSON.parse(bodyText) as { error?: string };
          if (typeof parsed?.error === "string" && parsed.error.trim()) detail = parsed.error.trim();
        } catch {
          /* keep detail as text */
        }
        toast({ title: "Export failed", description: detail, variant: "destructive" });
        return;
      }

      const trimmed = bodyText.trim();
      if (!trimmed) {
        toast({
          title: "Export unavailable",
          description: "Server returned empty data. Try again or contact support.",
          variant: "destructive",
        });
        return;
      }

      try {
        JSON.parse(trimmed);
      } catch {
        toast({
          title: "Export failed",
          description: "Response was not valid JSON (check API URL and authentication).",
          variant: "destructive",
        });
        return;
      }

      const blob = new Blob([trimmed], { type: "application/json;charset=utf-8" });
      triggerBlobDownload(blob, `valyoued-export-${new Date().toISOString().slice(0, 10)}.json`);
      toast({ title: "Export ready", description: "Your JSON download should begin shortly." });
    } catch (e) {
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const checkout = async () => {
    setBusy("checkout");
    try {
      const trimmedCode = discountCode.trim();
      const { url, error } = await postBilling(
        "checkout-session",
        getToken,
        {
          plan: checkoutPlan,
          ...(trimmedCode ? { promotionCode: trimmedCode } : {}),
        },
      );
      if (error) {
        toast({ title: "Checkout unavailable", description: error, variant: "destructive" });
        return;
      }
      if (url) window.location.href = url;
    } finally {
      setBusy(null);
    }
  };

  const portal = async () => {
    setBusy("portal");
    try {
      const { url, error } = await postBilling("customer-portal", getToken, {});
      if (error) {
        toast({ title: "Billing portal", description: error, variant: "destructive" });
        return;
      }
      if (url) window.location.href = url;
    } finally {
      setBusy(null);
    }
  };

  const checkoutInheritanceAddon = async () => {
    setBusy("inheritance-addon");
    try {
      const { url, error } = await postBilling("checkout-session-inheritance-addon", getToken, {});
      if (error) {
        toast({ title: "Inheritance checkout unavailable", description: error, variant: "destructive" });
        return;
      }
      if (url) window.location.href = url;
    } finally {
      setBusy(null);
    }
  };

  const emailAlertsPaidOnly = billingLoading ? true : !billing?.hasPaidValuationTier;

  return (
    <div className="space-y-8 pb-16">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <PageTitle>Settings & privacy</PageTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Email alerts, account, portfolio currency, then data export and subscription billing.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 md:[&>*]:min-w-0">
        <Card className="border-border/80 bg-card/40 backdrop-blur-sm md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5 text-accent" />
              Email alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 max-w-lg">
            {emailAlertsPaidOnly ? (
              <p className="rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                Email alert toggles unlock on Everyday or Professional. Switch plan in the sidebar subscription strip (dev)
                or upgrade below, then return here.
              </p>
            ) : null}
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="alert-estimate-ready">New estimate ready</Label>
                <p className="text-xs text-muted-foreground">
                  One email per completed valuation with a link to the report.
                </p>
              </div>
              <Switch
                id="alert-estimate-ready"
                checked={emailAlerts?.estimateReadyEmail ?? false}
                disabled={emailAlerts == null || busy !== null || emailAlertsPaidOnly}
                onCheckedChange={(v) => void patchEmailAlert({ estimateReadyEmail: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="alert-product">Product updates</Label>
                <p className="text-xs text-muted-foreground">
                  Occasional news about features and improvements (preference stored; broadcasts not wired yet).
                </p>
              </div>
              <Switch
                id="alert-product"
                checked={emailAlerts?.productUpdatesEmail ?? false}
                disabled={emailAlerts == null || busy !== null || emailAlertsPaidOnly}
                onCheckedChange={(v) => void patchEmailAlert({ productUpdatesEmail: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="alert-monitor-value">Portfolio value‑change monitors</Label>
                <p className="text-xs text-muted-foreground">
                  When an item intent is monitor, pings fire after meaningful re-pricing. Requires Everyday or Professional alongside
                  the other email alerts above.
                </p>
              </div>
              <Switch
                id="alert-monitor-value"
                checked={emailAlerts?.monitorValueChangeEmail ?? false}
                disabled={
                  emailAlerts == null || busy !== null || emailAlertsPaidOnly
                }
                onCheckedChange={(v) => void patchEmailAlert({ monitorValueChangeEmail: v })}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={busy !== null || !emailAlerts?.deliveryEnabled}
                onClick={() => void sendTestEmail("connectivity")}
              >
                <Mail className="h-4 w-4" />
                {busy === "email-test:connectivity" ? "Sending…" : "Test connection"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null || !emailAlerts?.deliveryEnabled}
                onClick={() => void sendTestEmail("estimate_ready")}
              >
                {busy === "email-test:estimate_ready" ? "Sending…" : "Sample estimate ready"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null || !emailAlerts?.deliveryEnabled}
                onClick={() => void sendTestEmail("monitor_value")}
              >
                {busy === "email-test:monitor_value" ? "Sending…" : "Sample monitor alert"}
              </Button>
            </div>
            {authStub ? (
              <div className="space-y-2 rounded-xl border border-dashed border-border/70 bg-muted/20 p-3">
                <Label htmlFor="stub-test-email">Test recipient (auth stub)</Label>
                <Input
                  id="stub-test-email"
                  type="email"
                  placeholder="you@example.com"
                  value={stubTestEmail}
                  onChange={(e) => {
                    const next = e.target.value;
                    setStubTestEmail(next);
                    if (next.trim()) localStorage.setItem("valyoued.stub-test-email", next);
                    else localStorage.removeItem("valyoued.stub-test-email");
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Stub mode has no Clerk inbox. Enter your address here or set STUB_TEST_EMAIL in .env.
                </p>
              </div>
            ) : null}
            {emailAlerts?.devToolsEnabled ? (
              <div className="space-y-2 rounded-xl border border-dashed border-accent/30 bg-accent/5 p-3">
                <p className="text-sm font-medium text-foreground">Real monitor scan (dev)</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Uses your saved valuations with intent Monitor. Normal scan needs about 3% uplift since baseline;
                  force scan alerts on any monitored row (same email template as production).
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={
                      busy !== null ||
                      emailAlertsPaidOnly ||
                      !emailAlerts.monitorValueChangeEmail
                    }
                    onClick={() => void runMonitorScan(false)}
                  >
                    {busy === "monitor-scan" ? "Scanning…" : "Run monitor scan"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      busy !== null ||
                      emailAlertsPaidOnly ||
                      !emailAlerts.monitorValueChangeEmail
                    }
                    onClick={() => void runMonitorScan(true)}
                  >
                    {busy === "monitor-scan-force" ? "Scanning…" : "Force scan (any monitor row)"}
                  </Button>
                </div>
              </div>
            ) : null}
            {!emailAlerts?.deliveryEnabled ? (
              <p className="text-xs text-muted-foreground">
                To enable sending, set RESEND_API_KEY and EMAIL_FROM on the API server, then restart it.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/40 backdrop-blur-sm md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe2 className="h-5 w-5 text-accent" />
              Portfolio &amp; analytics currency
            </CardTitle>
            <CardDescription>
              Combined totals on the home snapshot, portfolio, stats, and markets use one display currency so
              mixed-currency valuations can be compared. Individual reports stay in each item&apos;s own
              currency.{" "}
              <span className="text-foreground font-medium tabular-nums">
                Now showing {displayCurrencyCode}
                {getStoredReferenceCurrency()
                  ? " (pinned)"
                  : geoLedToCurrency
                    ? " (from network location hint)"
                    : " (from browser locale)"}
                .
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="max-w-md space-y-2">
            <Select
              value={getStoredReferenceCurrency() ?? "auto"}
              onValueChange={(v) => setDisplayCurrency(v === "auto" ? null : v)}
            >
              <SelectTrigger aria-label="Display currency for combined totals">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automatic (from browser locale)</SelectItem>
                {DISPLAY_CURRENCY_OPTIONS.map((o) => (
                  <SelectItem key={o.code} value={o.code}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/40 backdrop-blur-sm md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserRound className="h-5 w-5 text-accent" />
              Account &amp; profile
            </CardTitle>
            <CardDescription>
              Name, avatar, email, passwords, two-factor authentication, and social sign-in (for
              example Google) are managed by your account provider. ValYoued stores valuation and
              listing drafts only. It never stores your password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto gap-2"
              disabled={!onOpenProfile}
              onClick={() => onOpenProfile?.()}
            >
              <UserRound className="h-4 w-4" />
              Manage account &amp; security
            </Button>
            {!onOpenProfile ? (
              <p className="text-xs text-muted-foreground mt-3">
                Profile management is available with a live sign-in session (disabled in dev auth
                stub).
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-accent" />
              Data & privacy
            </CardTitle>
            <CardDescription>
              Download everything ValYoued stores about your valuations and listing drafts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="default"
              className="w-full gap-2"
              onClick={() => void exportData()}
              disabled={busy !== null}
              data-testid="btn-export-data"
            >
              <Download className="h-4 w-4" />
              {busy === "export" ? "Preparing…" : "Download data export (JSON)"}
            </Button>
            <Link href="/privacy" className="block">
              <Button variant="outline" className="w-full gap-2">
                <ExternalLink className="h-4 w-4" />
                Privacy & lawful basis
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-accent" />
              Subscription &amp; valuations
            </CardTitle>
            {billing ? (
              <CardDescription className="leading-relaxed text-pretty">
                <>
                  API tier{" "}
                  <span className="font-medium text-foreground tabular-nums">{billing.tier}</span>
                  {billing.status ? (
                    <>
                      {" "}
                      · <span className="tabular-nums font-medium">{billing.status}</span>
                    </>
                  ) : null}
                  {billing.planSlug ? (
                    <>
                      {" "}
                      · plan <span className="font-medium">{planTierDisplayName(billing.planSlug)}</span>
                    </>
                  ) : null}
                  {!billing.hasPaidValuationTier && billing.valuationsRemainingFree != null ? (
                    <>
                      {" "}
                      ·{" "}
                      <span className="font-medium text-foreground">{billing.valuationsRemainingFree}</span> free
                      valuations left this month (Free tier cap is{" "}
                      {billing.valuationsMonthLimit ?? 5}
                      ).
                    </>
                  ) : null}
                </>
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {!billing?.hasPaidValuationTier ? (
              <>
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Select value={checkoutPlan} onValueChange={(v) => setCheckoutPlan(v as typeof checkoutPlan)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="everyday_plus">Everyday · £7.99/mo</SelectItem>
                      <SelectItem value="professional">Professional · £19.99/mo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount-code">Discount code</Label>
                  <Input
                    id="discount-code"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    placeholder="Optional"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">
                You&apos;re subscribed. Everyday adds unlimited valuations, full arbitrage payout rows, and configurable
                monitor alerts. Professional also adds seller-grade listing presets, the seller playbook on new valuations,
                and desk portfolios. We email you about three days before each renewal charge. Use the portal to change
                plans or payment details.
              </p>
            )}
            <Button
              variant="default"
              className="w-full gap-2"
              onClick={() => void checkout()}
              disabled={busy !== null || billing?.hasPaidValuationTier}
            >
              <CreditCard className="h-4 w-4" />
              {busy === "checkout" ? "Redirecting…" : "Go to checkout"}
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => void portal()}
              disabled={busy !== null || !billing?.stripeCustomerId}
            >
              Manage subscription / invoices
            </Button>
            {!billing?.hasInheritanceAddon && billing?.planSlug !== "professional" ? (
              <div
                id="inheritance-addon"
                className="scroll-mt-28 rounded-xl border border-dashed border-accent/35 bg-accent/5 p-4 text-sm text-muted-foreground"
              >
                <p className="font-medium text-foreground">Inheritance add-on workspace</p>
                <p className="mt-2 leading-relaxed">
                  Spins up a tinted workspace beside your everyday portfolio once Stripe confirms the addon subscription.
                  Use it for estate rehearsal, heirloom tracking, or a second household portfolio.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3 w-full gap-2"
                  onClick={() => void checkoutInheritanceAddon()}
                  disabled={busy !== null}
                >
                  <CreditCard className="h-4 w-4" />
                  {busy === "inheritance-addon" ? "Opening checkout…" : "Start inheritance add-on"}
                </Button>
              </div>
            ) : billing?.hasInheritanceAddon ? (
              <div id="inheritance-addon" className="scroll-mt-28 space-y-2">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">What this adds:</span> a second tinted Portfolio workspace next to your
                  everyday holdings. Use it so estate rehearsals, heirloom lists, or a spare household tally stay visually and
                  structurally apart from daily net worth tracking.
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">Where to use it:</span> tap{" "}
                  <span className="text-foreground">Inheritance</span> in the Insights nav bar whenever that chip is visible,
                  switch workspace pills at the top of Home, then open Portfolio. New valuations attach to whichever workspace you
                  had selected before you hit Valuate.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SettingsWithClerk() {
  const { getToken } = useAuth();
  const { openUserProfile } = useClerk();
  return (
    <SettingsPageInner
      getToken={getToken}
      onOpenProfile={() => {
        void openUserProfile();
      }}
    />
  );
}

export default function SettingsPage() {
  const authStub = useAuthStubContext();
  if (authStub) {
    return <SettingsPageInner getToken={async () => null} authStub />;
  }
  return <SettingsWithClerk />;
}
