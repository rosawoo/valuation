import type { UseFormReturn } from "react-hook-form";
import { structuredConditionToScore, batteryAnswerToPercent } from "./engine";
import type { ConfidenceResult, VerificationAnswers } from "./types";

/** Keys collected during identification — skip in later wizard driver steps. */
export const VERIFICATION_COVERED_FIELD_KEYS = new Set([
  "color",
  "storage",
  "batteryHealth",
  "networkLock",
]);

export function applyVerificationToForm(
  form: UseFormReturn<Record<string, string | number | undefined>>,
  answers: VerificationAnswers,
  confidence: ConfidenceResult | null,
): void {
  const match = confidence?.confirmed ? confidence.primary : null;
  const modelName = match?.model ?? answers.modelName;
  const brand = match?.brand ?? answers.brand;

  if (brand) form.setValue("brand", brand, { shouldValidate: true });
  if (modelName) {
    form.setValue("model", modelName, { shouldValidate: true });
    const title = String(form.getValues("title") ?? "").trim();
    if (!title) {
      const headline = [brand, modelName, match?.storage, match?.color].filter(Boolean).join(" ");
      form.setValue("title", headline, { shouldValidate: true });
    }
  }
  if (answers.color || match?.color) {
    form.setValue("color", answers.color ?? match?.color ?? "", { shouldValidate: true });
  }
  if (answers.storage || match?.storage) {
    form.setValue("storage", answers.storage ?? match?.storage ?? "", { shouldValidate: true });
  }
  const batteryPct = batteryAnswerToPercent(answers.batteryHealth ?? answers.identificationAnswers.battery);
  if (batteryPct) {
    form.setValue("batteryHealth", Number(batteryPct), { shouldValidate: true });
  }
  if (answers.modelNumber) {
    form.setValue("modelNumber", answers.modelNumber, { shouldValidate: true });
  }

  const conditionScore = structuredConditionToScore(answers.condition);
  form.setValue("condition", conditionScore, { shouldValidate: true });
}

export function verificationToExtraFields(
  answers: VerificationAnswers,
  confidence: ConfidenceResult | null,
): Record<string, string> {
  const extras: Record<string, string> = {};
  const parts: string[] = [];
  if (answers.condition.screen) parts.push(`Screen: ${answers.condition.screen}`);
  if (answers.condition.body) parts.push(`Body: ${answers.condition.body}`);
  if (answers.condition.battery) parts.push(`Battery condition: ${answers.condition.battery}`);
  if (answers.condition.repairs) parts.push(`Repairs: ${answers.condition.repairs}`);
  if (parts.length) extras.structuredCondition = parts.join("; ");
  if (answers.modelNumber) extras.modelNumber = answers.modelNumber;
  if (confidence?.primary) {
    extras.identificationConfidence = String(confidence.confidencePct);
    extras.identifiedItem = confidence.primary.label;
  }
  extras.knowledgeLevel = answers.knowledgeLevel;
  return extras;
}
