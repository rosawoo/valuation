/** How well the user knows their item before verification. */
export type KnowledgeLevel = "exact" | "unsure" | "unknown";

export type StructuredCondition = {
  screen?: string;
  body?: string;
  battery?: string;
  repairs?: string;
};

export type VerificationAnswers = {
  knowledgeLevel: KnowledgeLevel;
  modelName?: string;
  brand?: string;
  color?: string;
  storage?: string;
  batteryHealth?: string;
  modelNumber?: string;
  modelNumberSkipped?: boolean;
  condition: StructuredCondition;
  /** Full identification assistant answers keyed by question id. */
  identificationAnswers: Record<string, string>;
};

export type DeviceMatch = {
  id: string;
  label: string;
  brand: string;
  model: string;
  storage?: string;
  color?: string;
  score: number;
};

export type ConfidenceResult = {
  primary: DeviceMatch | null;
  alternatives: DeviceMatch[];
  confidencePct: number;
  confirmed: boolean;
};

export type IdentificationQuestion = {
  id: string;
  prompt: string;
  whyItHelps: string;
  options: { value: string; label: string }[];
  /** Profile ids this question applies to (empty = all). */
  profiles?: string[];
};

export type IdentificationProfile = {
  id: string;
  label: string;
  assetTypeIds: string[];
  colorLibraryId?: string;
  deviceHintBrand?: "apple" | "samsung" | "google" | "generic";
  shortFlowSteps: ShortFlowStepId[];
  fullFlowQuestionIds: string[];
};

export type ShortFlowStepId =
  | "model"
  | "color"
  | "storage"
  | "battery"
  | "modelNumber"
  | "condition";

export const SKIP_VALUE = "__skip__";
export const UNKNOWN_VALUE = "__unknown__";
