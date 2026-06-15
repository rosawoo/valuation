import { useState } from "react";
import { ShortVerificationFlow } from "./ShortVerificationFlow";
import { IdentificationAssistant } from "./IdentificationAssistant";
import { getProfileForAssetType } from "@/lib/identification/profiles";
import { computeConfidence } from "@/lib/identification/engine";
import type { ConfidenceResult, KnowledgeLevel, VerificationAnswers } from "@/lib/identification/types";

export type IdentificationCompletePayload = {
  answers: VerificationAnswers;
  confidence: ConfidenceResult | null;
};

type ValuationIdentificationStepProps = {
  assetTypeId: string;
  knowledgeLevel: KnowledgeLevel;
  onComplete: (payload: IdentificationCompletePayload) => void;
};

export function ValuationIdentificationStep({
  assetTypeId,
  knowledgeLevel,
  onComplete,
}: ValuationIdentificationStepProps) {
  const profile = getProfileForAssetType(assetTypeId);
  const [phase, setPhase] = useState<"short" | "assistant">(
    knowledgeLevel === "exact" ? "short" : "assistant",
  );

  if (phase === "short") {
    return (
      <ShortVerificationFlow
        profile={profile}
        assetTypeId={assetTypeId}
        knowledgeLevel={knowledgeLevel}
        onComplete={(answers) => {
          const confidence = computeConfidence(profile, answers);
          onComplete({
            answers,
            confidence: { ...confidence, confirmed: true },
          });
        }}
      />
    );
  }

  return (
    <IdentificationAssistant
      profile={profile}
      assetTypeId={assetTypeId}
      knowledgeLevel={knowledgeLevel}
      onComplete={(answers, confidence) => onComplete({ answers, confidence })}
    />
  );
}
