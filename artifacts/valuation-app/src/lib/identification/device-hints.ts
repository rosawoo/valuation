export type DeviceHintBrand = "apple" | "samsung" | "google" | "generic";

export type SettingsHint = {
  title: string;
  steps: string[];
  note?: string;
};

export function storageHintForBrand(brand: DeviceHintBrand): SettingsHint {
  switch (brand) {
    case "apple":
      return {
        title: "Find storage on iPhone / iPad",
        steps: ["Open Settings", "Tap General", "Tap About", "Read Capacity"],
        note: "Capacity shows total storage (e.g. 256 GB).",
      };
    case "samsung":
      return {
        title: "Find storage on Samsung Galaxy",
        steps: ["Open Settings", "Tap Battery and device care", "Tap Storage"],
      };
    case "google":
      return {
        title: "Find storage on Google Pixel",
        steps: ["Open Settings", "Tap Storage"],
      };
    default:
      return {
        title: "Find storage capacity",
        steps: ["Open Settings", "Look for Storage or About phone", "Note the total capacity shown"],
      };
  }
}

export function batteryHintForBrand(brand: DeviceHintBrand): SettingsHint {
  switch (brand) {
    case "apple":
      return {
        title: "Find battery health on iPhone",
        steps: ["Open Settings", "Tap Battery", "Tap Battery Health & Charging", "Read Maximum Capacity %"],
      };
    case "samsung":
      return {
        title: "Find battery health on Samsung",
        steps: ["Open Settings", "Tap Battery and device care", "Tap Battery", "Check battery status or use Samsung Members diagnostics"],
      };
    case "google":
      return {
        title: "Find battery health on Pixel",
        steps: ["Open Settings", "Tap Battery", "Review battery usage; use AccuBattery or device diagnostics for health %"],
      };
    default:
      return {
        title: "Find battery health",
        steps: ["Open Settings", "Search for Battery", "Look for health, maximum capacity, or battery status"],
      };
  }
}

export function modelNumberHintForBrand(brand: DeviceHintBrand): SettingsHint {
  switch (brand) {
    case "apple":
      return {
        title: "Find model number on Apple device",
        steps: ["Open Settings", "Tap General", "Tap About", "Tap Model Number (may show part number first — tap again for A-number)"],
        note: "The A-number (e.g. A2890) is the most precise identifier for valuation.",
      };
    case "samsung":
      return {
        title: "Find model number on Samsung",
        steps: ["Open Settings", "Tap About phone", "Read Model number"],
      };
    case "google":
      return {
        title: "Find model number on Google Pixel",
        steps: ["Open Settings", "Tap About phone", "Tap Device information", "Read Model"],
      };
    default:
      return {
        title: "Find model number",
        steps: ["Open Settings", "Tap About phone or About device", "Read Model number or Model"],
      };
  }
}

export function inferDeviceHintBrand(
  brandText: string | undefined,
  assetTypeId: string,
): DeviceHintBrand {
  const b = (brandText ?? "").toLowerCase();
  if (b.includes("apple") || b.includes("iphone") || b.includes("ipad") || b.includes("mac")) return "apple";
  if (b.includes("samsung") || b.includes("galaxy")) return "samsung";
  if (b.includes("google") || b.includes("pixel")) return "google";
  if (assetTypeId === "smartphone" || assetTypeId === "tablet" || assetTypeId === "laptop") return "generic";
  return "generic";
}
