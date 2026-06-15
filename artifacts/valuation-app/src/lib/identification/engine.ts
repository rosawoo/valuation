import { matchCatalog } from "./catalog";
import type { ConfidenceResult, VerificationAnswers } from "./types";
import type { IdentificationProfile } from "./types";

export function computeConfidence(
  profile: IdentificationProfile,
  answers: VerificationAnswers,
): ConfidenceResult {
  const matches = matchCatalog(profile.id, answers.identificationAnswers, {
    modelName: answers.modelName,
    color: answers.color,
    storage: answers.storage,
  });

  const primary = matches[0] ?? null;
  const alternatives = matches.slice(1, 4);
  const confidencePct = primary?.score ?? (answers.modelName ? 70 : 40);

  return {
    primary,
    alternatives,
    confidencePct,
    confirmed: false,
  };
}

export function structuredConditionToScore(condition: VerificationAnswers["condition"]): number {
  let score = 7;
  const screen = condition.screen ?? "";
  const body = condition.body ?? "";
  const battery = condition.battery ?? "";
  const repairs = condition.repairs ?? "";

  if (screen === "Perfect") score += 1;
  else if (screen === "Minor Scratches") score += 0;
  else if (screen === "Moderate Scratches") score -= 1;
  else if (screen === "Cracked") score -= 3;

  if (body === "Excellent") score += 0.5;
  else if (body === "Good") score += 0;
  else if (body === "Fair") score -= 1;
  else if (body === "Poor") score -= 2;

  if (battery === "Above 90%") score += 0.5;
  else if (battery === "Below 80%") score -= 1;

  if (repairs === "Screen Replacement") score -= 0.5;
  else if (repairs === "Battery Replacement") score -= 0.25;
  else if (repairs === "Other") score -= 1;

  return Math.max(1, Math.min(10, Math.round(score)));
}

export function batteryAnswerToPercent(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value === "90+") return "95";
  if (value === "80-89") return "85";
  if (value === "below-80") return "75";
  if (/^\d+$/.test(value)) return value;
  return undefined;
}
