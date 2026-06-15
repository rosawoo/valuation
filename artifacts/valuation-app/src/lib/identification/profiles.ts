import type { IdentificationProfile, IdentificationQuestion } from "./types";

export const IDENTIFICATION_PROFILES: IdentificationProfile[] = [
  {
    id: "phone",
    label: "Smartphone",
    assetTypeIds: ["smartphone"],
    colorLibraryId: "apple",
    deviceHintBrand: "apple",
    shortFlowSteps: ["model", "color", "storage", "battery", "modelNumber", "condition"],
    fullFlowQuestionIds: [
      "platform",
      "rearCameras",
      "dynamicIsland",
      "homeButton",
      "chargingPort",
      "screenSize",
      "color",
      "storage",
      "battery",
    ],
  },
  {
    id: "tablet",
    label: "Tablet",
    assetTypeIds: ["tablet"],
    colorLibraryId: "apple",
    deviceHintBrand: "apple",
    shortFlowSteps: ["model", "color", "storage", "battery", "modelNumber", "condition"],
    fullFlowQuestionIds: ["platform", "screenSize", "color", "storage", "battery"],
  },
  {
    id: "laptop",
    label: "Laptop",
    assetTypeIds: ["laptop"],
    colorLibraryId: "apple",
    deviceHintBrand: "apple",
    shortFlowSteps: ["model", "color", "storage", "condition"],
    fullFlowQuestionIds: ["platform", "screenSize", "storage", "color"],
  },
  {
    id: "watch",
    label: "Watch",
    assetTypeIds: ["luxury-watch", "vintage-watch"],
    colorLibraryId: "luxury",
    shortFlowSteps: ["model", "color", "condition"],
    fullFlowQuestionIds: ["watchBrand", "caseMaterial", "dialColor", "complications"],
  },
  {
    id: "camera",
    label: "Camera",
    assetTypeIds: ["camera"],
    colorLibraryId: "neutral",
    shortFlowSteps: ["model", "color", "condition"],
    fullFlowQuestionIds: ["cameraBrand", "mountType", "sensorFormat"],
  },
  {
    id: "handbag",
    label: "Handbag",
    assetTypeIds: ["designer-handbag"],
    colorLibraryId: "luxury",
    shortFlowSteps: ["model", "color", "condition"],
    fullFlowQuestionIds: ["handbagBrand", "hardware", "material", "color"],
  },
  {
    id: "jewellery",
    label: "Jewellery",
    assetTypeIds: ["fine-jewelry"],
    colorLibraryId: "luxury",
    shortFlowSteps: ["model", "color", "condition"],
    fullFlowQuestionIds: ["jewelleryType", "metal", "gemstones"],
  },
  {
    id: "sneakers",
    label: "Sneakers",
    assetTypeIds: ["sneakers"],
    colorLibraryId: "neutral",
    shortFlowSteps: ["model", "color", "condition"],
    fullFlowQuestionIds: ["sneakerBrand", "size", "colorway"],
  },
  {
    id: "trading-cards",
    label: "Trading cards",
    assetTypeIds: ["trading-cards"],
    colorLibraryId: "neutral",
    shortFlowSteps: ["model", "condition"],
    fullFlowQuestionIds: ["cardGame", "setName", "grade"],
  },
  {
    id: "collectible",
    label: "Collectible",
    assetTypeIds: ["fine-art", "wine-spirits", "general-item"],
    colorLibraryId: "neutral",
    shortFlowSteps: ["model", "condition"],
    fullFlowQuestionIds: ["itemCategory", "era", "provenance"],
  },
  {
    id: "vehicle",
    label: "Vehicle",
    assetTypeIds: ["car", "classic-car", "everyday-car", "motorcycle"],
    colorLibraryId: "neutral",
    shortFlowSteps: ["model", "color", "condition"],
    fullFlowQuestionIds: ["vehicleMake", "fuelType", "mileageBand"],
  },
];

export const IDENTIFICATION_QUESTIONS: IdentificationQuestion[] = [
  {
    id: "platform",
    prompt: "Is it Apple or Android?",
    whyItHelps: "Platform narrows the entire device family before we match specs.",
    options: [
      { value: "apple", label: "Apple (iPhone, iPad, Mac)" },
      { value: "android", label: "Android (Samsung, Pixel, etc.)" },
      { value: "other", label: "Other / not sure" },
    ],
    profiles: ["phone", "tablet", "laptop"],
  },
  {
    id: "rearCameras",
    prompt: "How many rear cameras does it have?",
    whyItHelps: "Camera layout is one of the fastest ways to distinguish iPhone generations.",
    options: [
      { value: "1", label: "One camera" },
      { value: "2", label: "Two cameras" },
      { value: "3", label: "Three cameras" },
    ],
    profiles: ["phone"],
  },
  {
    id: "dynamicIsland",
    prompt: "Does it have a Dynamic Island (pill-shaped cutout at the top)?",
    whyItHelps: "Dynamic Island appeared on iPhone 14 Pro and later Pro models.",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "notch", label: "It has a notch instead" },
    ],
    profiles: ["phone"],
  },
  {
    id: "homeButton",
    prompt: "Does it have a physical home button on the front?",
    whyItHelps: "Home button vs edge-to-edge screen separates older from modern models.",
    options: [
      { value: "yes", label: "Yes, home button" },
      { value: "no", label: "No, full-screen face" },
    ],
    profiles: ["phone", "tablet"],
  },
  {
    id: "chargingPort",
    prompt: "What charging port does it use?",
    whyItHelps: "Lightning vs USB-C helps date the model (iPhone 15+ uses USB-C).",
    options: [
      { value: "usb-c", label: "USB-C" },
      { value: "lightning", label: "Lightning" },
      { value: "unknown", label: "Not sure" },
    ],
    profiles: ["phone", "tablet"],
  },
  {
    id: "screenSize",
    prompt: "Roughly how big is the screen?",
    whyItHelps: "Screen size separates standard, Plus/Max, and compact models.",
    options: [
      { value: "compact", label: 'Under 6" (compact)' },
      { value: "standard", label: '6" – 6.5" (standard)' },
      { value: "large", label: '6.5"+ (Plus / Max / large)' },
    ],
    profiles: ["phone", "tablet", "laptop"],
  },
  {
    id: "color",
    prompt: "What colour is it?",
    whyItHelps: "Colour confirms the exact variant buyers search for.",
    options: [],
    profiles: ["phone", "tablet", "laptop", "handbag", "sneakers"],
  },
  {
    id: "storage",
    prompt: "What storage size does it have?",
    whyItHelps: "Storage tier is one of the biggest price drivers for electronics.",
    options: [
      { value: "64GB", label: "64 GB" },
      { value: "128GB", label: "128 GB" },
      { value: "256GB", label: "256 GB" },
      { value: "512GB", label: "512 GB" },
      { value: "1TB", label: "1 TB" },
    ],
    profiles: ["phone", "tablet", "laptop"],
  },
  {
    id: "battery",
    prompt: "What is the battery health percentage?",
    whyItHelps: "Battery health directly affects resale value for phones and laptops.",
    options: [
      { value: "90+", label: "90% or above" },
      { value: "80-89", label: "80% – 89%" },
      { value: "below-80", label: "Below 80%" },
    ],
    profiles: ["phone", "tablet", "laptop"],
  },
  {
    id: "watchBrand",
    prompt: "Which watch brand is it?",
    whyItHelps: "Brand sets the collector market and reference lookup.",
    options: [
      { value: "rolex", label: "Rolex" },
      { value: "omega", label: "Omega" },
      { value: "patek", label: "Patek Philippe" },
      { value: "other", label: "Other" },
    ],
    profiles: ["watch"],
  },
  {
    id: "caseMaterial",
    prompt: "What is the case material?",
    whyItHelps: "Steel, gold, and platinum tiers price very differently.",
    options: [
      { value: "steel", label: "Stainless steel" },
      { value: "gold", label: "Gold" },
      { value: "platinum", label: "Platinum" },
      { value: "titanium", label: "Titanium" },
      { value: "other", label: "Other" },
    ],
    profiles: ["watch"],
  },
  {
    id: "dialColor",
    prompt: "What colour is the dial?",
    whyItHelps: "Dial colour can swing value on popular references.",
    options: [
      { value: "black", label: "Black" },
      { value: "white", label: "White / silver" },
      { value: "blue", label: "Blue" },
      { value: "green", label: "Green" },
      { value: "other", label: "Other" },
    ],
    profiles: ["watch"],
  },
  {
    id: "complications",
    prompt: "Does it have notable complications?",
    whyItHelps: "Chronograph, GMT, and calendar functions affect reference matching.",
    options: [
      { value: "date", label: "Date only" },
      { value: "chrono", label: "Chronograph" },
      { value: "gmt", label: "GMT / dual time" },
      { value: "none", label: "Time only" },
    ],
    profiles: ["watch"],
  },
  {
    id: "cameraBrand",
    prompt: "Which camera brand?",
    whyItHelps: "Brand determines lens mount and resale channels.",
    options: [
      { value: "canon", label: "Canon" },
      { value: "sony", label: "Sony" },
      { value: "nikon", label: "Nikon" },
      { value: "fujifilm", label: "Fujifilm" },
      { value: "other", label: "Other" },
    ],
    profiles: ["camera"],
  },
  {
    id: "mountType",
    prompt: "What lens mount?",
    whyItHelps: "Mount type confirms body generation and kit compatibility.",
    options: [
      { value: "ef", label: "Canon EF / EF-S" },
      { value: "rf", label: "Canon RF" },
      { value: "e", label: "Sony E" },
      { value: "z", label: "Nikon Z" },
      { value: "other", label: "Other" },
    ],
    profiles: ["camera"],
  },
  {
    id: "sensorFormat",
    prompt: "Sensor size?",
    whyItHelps: "Full-frame vs APS-C separates pro from enthusiast bodies.",
    options: [
      { value: "full-frame", label: "Full frame" },
      { value: "aps-c", label: "APS-C" },
      { value: "m43", label: "Micro Four Thirds" },
      { value: "other", label: "Other" },
    ],
    profiles: ["camera"],
  },
  {
    id: "handbagBrand",
    prompt: "Which designer brand?",
    whyItHelps: "Brand authentication and model line drive luxury handbag pricing.",
    options: [
      { value: "hermes", label: "Hermès" },
      { value: "chanel", label: "Chanel" },
      { value: "louis-vuitton", label: "Louis Vuitton" },
      { value: "other", label: "Other" },
    ],
    profiles: ["handbag"],
  },
  {
    id: "hardware",
    prompt: "Hardware finish?",
    whyItHelps: "Gold vs palladium hardware affects variant matching.",
    options: [
      { value: "gold", label: "Gold" },
      { value: "palladium", label: "Palladium / silver" },
      { value: "ruthenium", label: "Ruthenium / dark" },
      { value: "other", label: "Other" },
    ],
    profiles: ["handbag"],
  },
  {
    id: "material",
    prompt: "Primary material?",
    whyItHelps: "Leather, canvas, and exotic skins price on different curves.",
    options: [
      { value: "leather", label: "Leather" },
      { value: "canvas", label: "Coated canvas" },
      { value: "exotic", label: "Exotic skin" },
      { value: "other", label: "Other" },
    ],
    profiles: ["handbag"],
  },
  {
    id: "jewelleryType",
    prompt: "What type of piece?",
    whyItHelps: "Ring, bracelet, and necklace comps use different markets.",
    options: [
      { value: "ring", label: "Ring" },
      { value: "bracelet", label: "Bracelet" },
      { value: "necklace", label: "Necklace / pendant" },
      { value: "earrings", label: "Earrings" },
      { value: "other", label: "Other" },
    ],
    profiles: ["jewellery"],
  },
  {
    id: "metal",
    prompt: "Primary metal?",
    whyItHelps: "Gold karat and platinum fineness anchor intrinsic value.",
    options: [
      { value: "yellow-gold", label: "Yellow gold" },
      { value: "white-gold", label: "White gold" },
      { value: "platinum", label: "Platinum" },
      { value: "silver", label: "Sterling silver" },
    ],
    profiles: ["jewellery"],
  },
  {
    id: "gemstones",
    prompt: "Main gemstones?",
    whyItHelps: "Centre stone type and size drive fine jewellery valuations.",
    options: [
      { value: "diamond", label: "Diamond" },
      { value: "sapphire", label: "Sapphire" },
      { value: "emerald", label: "Emerald" },
      { value: "none", label: "No major gemstones" },
      { value: "other", label: "Other" },
    ],
    profiles: ["jewellery"],
  },
  {
    id: "sneakerBrand",
    prompt: "Which sneaker brand?",
    whyItHelps: "Brand and collaboration line set the resale index.",
    options: [
      { value: "nike", label: "Nike / Jordan" },
      { value: "adidas", label: "adidas / Yeezy" },
      { value: "new-balance", label: "New Balance" },
      { value: "other", label: "Other" },
    ],
    profiles: ["sneakers"],
  },
  {
    id: "size",
    prompt: "UK / EU size (if known)?",
    whyItHelps: "Size liquidity varies widely on hype releases.",
    options: [
      { value: "small", label: "UK 6–8 / EU 39–42" },
      { value: "mid", label: "UK 8.5–10 / EU 42.5–44" },
      { value: "large", label: "UK 10.5+ / EU 44.5+" },
    ],
    profiles: ["sneakers"],
  },
  {
    id: "colorway",
    prompt: "Dominant colourway?",
    whyItHelps: "Colourway name is how buyers search resale listings.",
    options: [
      { value: "black", label: "Mostly black" },
      { value: "white", label: "Mostly white" },
      { value: "multi", label: "Multi-colour" },
      { value: "other", label: "Other" },
    ],
    profiles: ["sneakers"],
  },
  {
    id: "cardGame",
    prompt: "Which card game or category?",
    whyItHelps: "Game sets the comp database and grading norms.",
    options: [
      { value: "pokemon", label: "Pokémon" },
      { value: "mtg", label: "Magic: The Gathering" },
      { value: "sports", label: "Sports cards" },
      { value: "other", label: "Other" },
    ],
    profiles: ["trading-cards"],
  },
  {
    id: "setName",
    prompt: "Set or series (if known)?",
    whyItHelps: "Set name narrows to the exact print run.",
    options: [
      { value: "vintage", label: "Vintage / early sets" },
      { value: "modern", label: "Modern standard" },
      { value: "special", label: "Special / limited edition" },
      { value: "unknown", label: "Not sure" },
    ],
    profiles: ["trading-cards"],
  },
  {
    id: "grade",
    prompt: "Graded or raw?",
    whyItHelps: "PSA/BGS slab grade dominates trading card pricing.",
    options: [
      { value: "psa10", label: "PSA 10 / gem mint slab" },
      { value: "psa9", label: "PSA 9 / mint slab" },
      { value: "raw-nm", label: "Raw — near mint" },
      { value: "raw-played", label: "Raw — played condition" },
    ],
    profiles: ["trading-cards"],
  },
  {
    id: "itemCategory",
    prompt: "What kind of collectible?",
    whyItHelps: "Category routes to the right comp methodology.",
    options: [
      { value: "art", label: "Art / print" },
      { value: "wine", label: "Wine / spirits" },
      { value: "memorabilia", label: "Memorabilia" },
      { value: "other", label: "Something else" },
    ],
    profiles: ["collectible"],
  },
  {
    id: "era",
    prompt: "Approximate era?",
    whyItHelps: "Age and period affect provenance and rarity pricing.",
    options: [
      { value: "contemporary", label: "Contemporary (2000+)" },
      { value: "vintage", label: "Vintage (1980–1999)" },
      { value: "antique", label: "Antique / pre-1980" },
    ],
    profiles: ["collectible"],
  },
  {
    id: "provenance",
    prompt: "Do you have provenance documentation?",
    whyItHelps: "Receipts and certificates strengthen valuation confidence.",
    options: [
      { value: "full", label: "Receipt + certificate" },
      { value: "partial", label: "Receipt or certificate" },
      { value: "none", label: "No paperwork" },
    ],
    profiles: ["collectible"],
  },
  {
    id: "vehicleMake",
    prompt: "Vehicle make (if known)?",
    whyItHelps: "Make and model anchor vehicle valuation tables.",
    options: [
      { value: "german", label: "German premium (BMW, Mercedes, Audi)" },
      { value: "japanese", label: "Japanese (Toyota, Honda, etc.)" },
      { value: "british", label: "British (Land Rover, Jaguar, etc.)" },
      { value: "american", label: "American" },
      { value: "other", label: "Other" },
    ],
    profiles: ["vehicle"],
  },
  {
    id: "fuelType",
    prompt: "Fuel / powertrain?",
    whyItHelps: "EV, hybrid, and diesel variants price differently.",
    options: [
      { value: "petrol", label: "Petrol" },
      { value: "diesel", label: "Diesel" },
      { value: "hybrid", label: "Hybrid" },
      { value: "electric", label: "Electric" },
    ],
    profiles: ["vehicle"],
  },
  {
    id: "mileageBand",
    prompt: "Approximate mileage?",
    whyItHelps: "Mileage is the primary depreciation driver for vehicles.",
    options: [
      { value: "low", label: "Under 30,000" },
      { value: "mid", label: "30,000 – 80,000" },
      { value: "high", label: "Over 80,000" },
    ],
    profiles: ["vehicle"],
  },
];

const questionMap = new Map(IDENTIFICATION_QUESTIONS.map((q) => [q.id, q]));

export function getProfileForAssetType(assetTypeId: string): IdentificationProfile {
  return (
    IDENTIFICATION_PROFILES.find((p) => p.assetTypeIds.includes(assetTypeId)) ??
    IDENTIFICATION_PROFILES.find((p) => p.id === "collectible")!
  );
}

export function supportsIdentificationFlow(assetTypeId: string): boolean {
  return IDENTIFICATION_PROFILES.some((p) => p.assetTypeIds.includes(assetTypeId));
}

export function questionsForProfile(profile: IdentificationProfile): IdentificationQuestion[] {
  return profile.fullFlowQuestionIds
    .map((id) => questionMap.get(id))
    .filter((q): q is IdentificationQuestion => q != null);
}

export function shortStepsForKnowledge(
  profile: IdentificationProfile,
  knowledge: import("./types").KnowledgeLevel,
): import("./types").ShortFlowStepId[] {
  const all = profile.shortFlowSteps;
  if (knowledge === "exact") {
    return all.filter((s) => s !== "modelNumber" || all.includes("modelNumber"));
  }
  if (knowledge === "unsure") {
    return all;
  }
  return all.filter((s) => s === "condition" || s === "color" || s === "storage");
}
