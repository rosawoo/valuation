export type ColourOption = {
  id: string;
  name: string;
  /** CSS colour for swatch / preview */
  hex: string;
};

export type ColourLibrary = {
  id: string;
  label: string;
  colours: ColourOption[];
};

const APPLE_DEVICE_COLOURS: ColourOption[] = [
  { id: "space-black", name: "Space Black", hex: "#1d1d1f" },
  { id: "space-grey", name: "Space Grey", hex: "#8e8e93" },
  { id: "silver", name: "Silver", hex: "#e3e4e5" },
  { id: "gold", name: "Gold", hex: "#f9e5c9" },
  { id: "rose-gold", name: "Rose Gold", hex: "#e8c4b8" },
  { id: "midnight", name: "Midnight", hex: "#1f2020" },
  { id: "starlight", name: "Starlight", hex: "#faf6f2" },
  { id: "blue", name: "Blue", hex: "#276787" },
  { id: "purple", name: "Purple", hex: "#594f63" },
  { id: "green", name: "Green", hex: "#394c38" },
  { id: "yellow", name: "Yellow", hex: "#f9e076" },
  { id: "pink", name: "Pink", hex: "#faddd7" },
  { id: "red", name: "Red", hex: "#bf0013" },
  { id: "natural-titanium", name: "Natural Titanium", hex: "#9a9a9d" },
  { id: "white-titanium", name: "White Titanium", hex: "#f2f1ed" },
  { id: "black-titanium", name: "Black Titanium", hex: "#3b3b3d" },
  { id: "blue-titanium", name: "Blue Titanium", hex: "#2f3f52" },
];

const NEUTRAL_COLOURS: ColourOption[] = [
  { id: "black", name: "Black", hex: "#1a1a1a" },
  { id: "white", name: "White", hex: "#f5f5f5" },
  { id: "grey", name: "Grey", hex: "#9ca3af" },
  { id: "silver", name: "Silver", hex: "#c0c0c0" },
  { id: "gold", name: "Gold", hex: "#d4af37" },
  { id: "blue", name: "Blue", hex: "#2563eb" },
  { id: "red", name: "Red", hex: "#dc2626" },
  { id: "green", name: "Green", hex: "#16a34a" },
  { id: "brown", name: "Brown", hex: "#78350f" },
  { id: "beige", name: "Beige", hex: "#d6c6a8" },
  { id: "multicolour", name: "Multicolour", hex: "linear-gradient(135deg,#ef4444,#3b82f6,#22c55e)" },
];

const LUXURY_COLOURS: ColourOption[] = [
  { id: "black", name: "Black", hex: "#111111" },
  { id: "gold", name: "Gold", hex: "#c9a227" },
  { id: "silver", name: "Silver", hex: "#b8b8b8" },
  { id: "rose-gold", name: "Rose Gold", hex: "#b76e79" },
  { id: "navy", name: "Navy", hex: "#1e3a5f" },
  { id: "burgundy", name: "Burgundy", hex: "#722f37" },
  { id: "tan", name: "Tan", hex: "#c4a574" },
  { id: "cream", name: "Cream", hex: "#f5f0e6" },
];

export const COLOUR_LIBRARIES: Record<string, ColourLibrary> = {
  apple: { id: "apple", label: "Apple device colours", colours: APPLE_DEVICE_COLOURS },
  neutral: { id: "neutral", label: "Standard colours", colours: NEUTRAL_COLOURS },
  luxury: { id: "luxury", label: "Luxury colours", colours: LUXURY_COLOURS },
};

export function getColourLibrary(libraryId: string | undefined): ColourLibrary {
  return COLOUR_LIBRARIES[libraryId ?? "neutral"] ?? COLOUR_LIBRARIES.neutral;
}
