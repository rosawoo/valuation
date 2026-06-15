import type { DeviceMatch } from "./types";

/** Catalog entry for client-side confidence matching (extensible per category). */
export type CatalogEntry = {
  id: string;
  brand: string;
  model: string;
  storage?: string;
  color?: string;
  traits: Record<string, string>;
};

export const PHONE_CATALOG: CatalogEntry[] = [
  {
    id: "iphone-15-pro-max-256-natural",
    brand: "Apple",
    model: "iPhone 15 Pro Max",
    storage: "256GB",
    color: "Natural Titanium",
    traits: { platform: "apple", rearCameras: "3", dynamicIsland: "yes", homeButton: "no", chargingPort: "usb-c", screenSize: "large" },
  },
  {
    id: "iphone-15-pro-256-natural",
    brand: "Apple",
    model: "iPhone 15 Pro",
    storage: "256GB",
    color: "Natural Titanium",
    traits: { platform: "apple", rearCameras: "3", dynamicIsland: "yes", homeButton: "no", chargingPort: "usb-c", screenSize: "standard" },
  },
  {
    id: "iphone-15-128-black",
    brand: "Apple",
    model: "iPhone 15",
    storage: "128GB",
    color: "Black",
    traits: { platform: "apple", rearCameras: "2", dynamicIsland: "no", homeButton: "no", chargingPort: "usb-c", screenSize: "standard" },
  },
  {
    id: "iphone-14-pro-256-purple",
    brand: "Apple",
    model: "iPhone 14 Pro",
    storage: "256GB",
    color: "Deep Purple",
    traits: { platform: "apple", rearCameras: "3", dynamicIsland: "yes", homeButton: "no", chargingPort: "lightning", screenSize: "standard" },
  },
  {
    id: "iphone-14-pro-128-purple",
    brand: "Apple",
    model: "iPhone 14 Pro",
    storage: "128GB",
    color: "Deep Purple",
    traits: { platform: "apple", rearCameras: "3", dynamicIsland: "yes", homeButton: "no", chargingPort: "lightning", screenSize: "standard" },
  },
  {
    id: "iphone-13-pro-256",
    brand: "Apple",
    model: "iPhone 13 Pro",
    storage: "256GB",
    color: "Graphite",
    traits: { platform: "apple", rearCameras: "3", dynamicIsland: "no", homeButton: "no", chargingPort: "lightning", screenSize: "standard" },
  },
  {
    id: "iphone-se-3-64",
    brand: "Apple",
    model: "iPhone SE (3rd gen)",
    storage: "64GB",
    color: "Midnight",
    traits: { platform: "apple", rearCameras: "1", dynamicIsland: "no", homeButton: "yes", chargingPort: "lightning", screenSize: "compact" },
  },
  {
    id: "galaxy-s24-ultra-256",
    brand: "Samsung",
    model: "Galaxy S24 Ultra",
    storage: "256GB",
    color: "Titanium Gray",
    traits: { platform: "android", rearCameras: "3", dynamicIsland: "no", homeButton: "no", chargingPort: "usb-c", screenSize: "large" },
  },
  {
    id: "pixel-8-pro-256",
    brand: "Google",
    model: "Pixel 8 Pro",
    storage: "256GB",
    color: "Obsidian",
    traits: { platform: "android", rearCameras: "3", dynamicIsland: "no", homeButton: "no", chargingPort: "usb-c", screenSize: "large" },
  },
];

export function catalogForProfile(profileId: string): CatalogEntry[] {
  if (profileId === "phone") return PHONE_CATALOG;
  return [];
}

function scoreEntry(
  entry: CatalogEntry,
  answers: Record<string, string>,
  modelHint?: string,
  colorHint?: string,
  storageHint?: string,
): number {
  let score = 0;
  let max = 0;
  for (const [key, value] of Object.entries(entry.traits)) {
    max += 10;
    const ans = answers[key];
    if (ans && ans !== "__skip__" && ans !== "__unknown__" && ans === value) score += 10;
    else if (ans && ans !== "__skip__" && ans !== "__unknown__" && value === "other") score += 3;
  }
  if (modelHint) {
    max += 20;
    const hint = modelHint.toLowerCase();
    const model = entry.model.toLowerCase();
    if (hint.includes(model) || model.includes(hint)) score += 20;
    else if (hint.split(/\s+/).some((w) => w.length > 3 && model.includes(w))) score += 10;
  }
  if (colorHint) {
    max += 10;
    if (entry.color?.toLowerCase().includes(colorHint.toLowerCase())) score += 10;
  }
  if (storageHint) {
    max += 10;
    if (entry.storage === storageHint) score += 10;
  }
  return max > 0 ? Math.round((score / max) * 100) : 0;
}

export function matchCatalog(
  profileId: string,
  answers: Record<string, string>,
  opts?: { modelName?: string; color?: string; storage?: string },
): DeviceMatch[] {
  const catalog = catalogForProfile(profileId);
  if (!catalog.length) {
    if (opts?.modelName) {
      return [
        {
          id: "user-model",
          label: opts.modelName,
          brand: answers.platform === "apple" ? "Apple" : answers.platform === "android" ? "Samsung" : "Unknown",
          model: opts.modelName,
          storage: opts.storage,
          color: opts.color,
          score: 75,
        },
      ];
    }
    return [];
  }
  return catalog
    .map((entry) => ({
      id: entry.id,
      label: [entry.model, entry.storage, entry.color].filter(Boolean).join(" "),
      brand: entry.brand,
      model: entry.model,
      storage: entry.storage,
      color: entry.color,
      score: scoreEntry(entry, answers, opts?.modelName, opts?.color, opts?.storage),
    }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);
}
