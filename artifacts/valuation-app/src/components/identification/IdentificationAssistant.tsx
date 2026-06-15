import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuestionOptionGroup } from "./QuestionOptionGroup";
import { ColourSelector } from "./ColourSelector";
import { StorageVerification } from "./StorageVerification";
import { BatteryHealthVerification } from "./BatteryHealthVerification";
import { StructuredConditionAssessment } from "./StructuredConditionAssessment";
import { IdentificationConfidenceCard } from "./IdentificationConfidenceCard";
import { questionsForProfile } from "@/lib/identification/profiles";
import { getColourLibrary } from "@/lib/identification/color-libraries";
import { inferDeviceHintBrand } from "@/lib/identification/device-hints";
import { computeConfidence } from "@/lib/identification/engine";
import type { ConfidenceResult, IdentificationProfile, KnowledgeLevel, StructuredCondition, VerificationAnswers } from "@/lib/identification/types";

type IdentificationAssistantProps = {
  profile: IdentificationProfile;
  assetTypeId: string;
  knowledgeLevel: KnowledgeLevel;
  onComplete: (answers: VerificationAnswers, confidence: ConfidenceResult) => void;
};

export function IdentificationAssistant({
  profile,
  assetTypeId,
  knowledgeLevel,
  onComplete,
}: IdentificationAssistantProps) {
  const questions = useMemo(() => questionsForProfile(profile), [profile]);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [condition, setCondition] = useState<StructuredCondition>({});
  const [confidence, setConfidence] = useState<ConfidenceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCondition, setShowCondition] = useState(false);

  const colours = getColourLibrary(profile.colorLibraryId).colours;
  const hintBrand = inferDeviceHintBrand(
    answers.platform === "apple" ? "Apple" : answers.platform === "android" ? "Samsung" : undefined,
    assetTypeId,
  );

  const totalSteps = questions.length + 1;
  const onQuestionPhase = !showCondition && stepIndex < questions.length;
  const currentQuestion = onQuestionPhase ? questions[stepIndex] : null;

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function runConfidence(nextAnswers: Record<string, string>): ConfidenceResult {
    const partial: VerificationAnswers = {
      knowledgeLevel,
      modelName: nextAnswers.modelHint,
      color: nextAnswers.color,
      storage: nextAnswers.storage,
      batteryHealth: nextAnswers.battery,
      condition,
      identificationAnswers: nextAnswers,
    };
    return computeConfidence(profile, partial);
  }

  function advance() {
    if (onQuestionPhase && currentQuestion) {
      if (stepIndex < questions.length - 1) {
        setStepIndex((i) => i + 1);
        return;
      }
      setLoading(true);
      window.setTimeout(() => {
        const result = runConfidence(answers);
        setConfidence(result);
        setLoading(false);
        if (result.confidencePct >= 90) return;
        setShowCondition(true);
        setStepIndex(questions.length);
      }, 400);
      return;
    }

    if (showCondition && !confidence) {
      const result = runConfidence(answers);
      setConfidence(result);
      return;
    }

    if (confidence) {
      finish(confidence, true);
    }
  }

  function finish(result: ConfidenceResult, confirmed: boolean) {
    const payload: VerificationAnswers = {
      knowledgeLevel,
      modelName: result.primary?.model,
      brand: result.primary?.brand,
      color: answers.color ?? result.primary?.color,
      storage: answers.storage ?? result.primary?.storage,
      batteryHealth: answers.battery,
      condition,
      identificationAnswers: answers,
    };
    onComplete(payload, { ...result, confirmed });
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="text-sm">Narrowing down possible matches…</p>
      </div>
    );
  }

  if (confidence && confidence.confidencePct >= 90) {
    return (
      <IdentificationConfidenceCard
        result={confidence}
        onConfirm={() => finish(confidence, true)}
        onContinue={() => {
          setConfidence(null);
          setShowCondition(true);
          setStepIndex(questions.length);
        }}
      />
    );
  }

  if (showCondition && stepIndex >= questions.length) {
    return (
      <div className="space-y-6">
        <StructuredConditionAssessment value={condition} onChange={setCondition} />
        {confidence ? (
          <IdentificationConfidenceCard
            result={confidence}
            onConfirm={() => finish(confidence, true)}
            onContinue={() => setConfidence(null)}
          />
        ) : null}
        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => setShowCondition(false)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to questions
          </Button>
          <Button type="button" onClick={advance}>
            {confidence ? "Use best match" : "See matches"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const isColorQ = currentQuestion.id === "color";
  const isStorageQ = currentQuestion.id === "storage";
  const isBatteryQ = currentQuestion.id === "battery";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Question {stepIndex + 1} of {totalSteps}
        </span>
      </div>

      {isColorQ ? (
        <ColourSelector
          colours={colours}
          value={answers.color}
          onChange={(v) => setAnswer("color", v)}
        />
      ) : isStorageQ ? (
        <StorageVerification
          brand={hintBrand}
          value={answers.storage}
          onChange={(v) => setAnswer("storage", v)}
        />
      ) : isBatteryQ ? (
        <BatteryHealthVerification
          brand={hintBrand}
          value={answers.battery}
          onChange={(v) => setAnswer("battery", v)}
        />
      ) : (
        <QuestionOptionGroup
          prompt={currentQuestion.prompt}
          whyItHelps={currentQuestion.whyItHelps}
          options={currentQuestion.options}
          value={answers[currentQuestion.id]}
          onChange={(v) => setAnswer(currentQuestion.id, v)}
          layout={currentQuestion.options.length > 4 ? "grid" : "list"}
        />
      )}

      <div className="flex justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          disabled={stepIndex === 0}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button type="button" onClick={advance}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
