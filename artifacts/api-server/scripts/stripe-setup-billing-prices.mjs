/**
 * Creates ValYoued Everyday / Professional subscription prices in Stripe when missing.
 * Usage (from repo root): node artifacts/api-server/scripts/stripe-setup-billing-prices.mjs
 *
 * Reads STRIPE_SECRET_KEY from the workspace root .env. Prints price IDs and appends
 * STRIPE_PRICE_EVERYDAY_PLUS / STRIPE_PRICE_PROFESSIONAL when they are not already set.
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(apiRoot, "..", "..");
const envPath = path.join(workspaceRoot, ".env");

dotenv.config({ path: envPath });
dotenv.config({ path: path.join(workspaceRoot, ".env.local"), override: true });

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) {
  console.error("Missing STRIPE_SECRET_KEY in the workspace root .env.");
  process.exit(1);
}

const PLANS = [
  {
    envKey: "STRIPE_PRICE_EVERYDAY_PLUS",
    planSlug: "everyday_plus",
    name: "ValYoued Everyday",
    description: "Unlimited valuations, full arbitrage rows, portfolio alerts.",
    unitAmount: 799,
  },
  {
    envKey: "STRIPE_PRICE_PROFESSIONAL",
    planSlug: "professional",
    name: "ValYoued Professional",
    description: "Seller-grade listings, desk portfolios, and Professional trial.",
    unitAmount: 1999,
  },
];

const stripe = new Stripe(key);

async function findExistingPrice(planSlug) {
  const products = await stripe.products.search({
    query: `metadata['valyoued_plan']:'${planSlug}'`,
    limit: 1,
  });
  const product = products.data[0];
  if (!product) return null;

  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
  const monthly = prices.data.find((p) => p.recurring?.interval === "month" && p.currency === "gbp");
  return monthly ?? prices.data[0] ?? null;
}

async function ensurePlanPrice(plan) {
  const existing = await findExistingPrice(plan.planSlug);
  if (existing) {
    console.log(`Found ${plan.planSlug}: ${existing.id} (${existing.unit_amount} ${existing.currency})`);
    return existing.id;
  }

  const product = await stripe.products.create({
    name: plan.name,
    description: plan.description,
    metadata: { valyoued_plan: plan.planSlug },
  });

  const price = await stripe.prices.create({
    product: product.id,
    currency: "gbp",
    unit_amount: plan.unitAmount,
    recurring: { interval: "month" },
    metadata: { valyoued_plan: plan.planSlug },
  });

  console.log(`Created ${plan.planSlug}: ${price.id} (${plan.unitAmount} gbp/month)`);
  return price.id;
}

function upsertEnvVar(filePath, envKey, value) {
  const line = `${envKey}=${value}`;
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `${line}\n`, "utf8");
    return "added";
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const re = new RegExp(`^${envKey}=.*$`, "m");
  if (re.test(raw)) {
    if (raw.match(re)[0] === line) return "unchanged";
    fs.writeFileSync(filePath, raw.replace(re, line), "utf8");
    return "updated";
  }

  const suffix = raw.endsWith("\n") || raw.length === 0 ? "" : "\n";
  fs.writeFileSync(filePath, `${raw}${suffix}${line}\n`, "utf8");
  return "added";
}

const resolved = {};
for (const plan of PLANS) {
  resolved[plan.envKey] = await ensurePlanPrice(plan);
}

console.log("\nAdd to .env (or confirm existing values):");
for (const plan of PLANS) {
  console.log(`${plan.envKey}=${resolved[plan.envKey]}`);
}

let envChanged = false;
for (const plan of PLANS) {
  const current = process.env[plan.envKey]?.trim();
  if (current) {
    console.log(`\n${plan.envKey} already set in environment; leaving .env unchanged for this key.`);
    continue;
  }
  const action = upsertEnvVar(envPath, plan.envKey, resolved[plan.envKey]);
  console.log(`\n${plan.envKey} ${action} in ${envPath}`);
  envChanged = true;
}

if (envChanged) {
  console.log("\nRestart the API server so checkout picks up the new price IDs.");
}
