import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColourSelector } from "./ColourSelector";
import { StorageVerification } from "./StorageVerification";
import { BatteryHealthVerification } from "./BatteryHealthVerification";
import { ModelNumberVerification } from "./ModelNumberVerification";
import { StructuredConditionAssessment } from "./StructuredConditionAssessment";
import { getColourLibrary } from "@/lib/identification/color-libraries";
import { inferDeviceHintBrand } from "@/lib/identification/device-hints";
import { shortStepsForKnowledge } from "@/lib/identification/profiles";
import type { IdentificationProfile } from "@/lib/identification/types";
import type { KnowledgeLevel, ShortFlowStepId, StructuredCondition, VerificationAnswers } from "@/lib/identification/types";
import { SKIP_VALUE } from "@/lib/identification/types";

type ShortVerificationFlowProps = {
  profile: IdentificationProfile;
  assetTypeId: string;
  knowledgeLevel: KnowledgeLevel;
  initial?: Partial<VerificationAnswers>;
  onComplete: (answers: VerificationAnswers) => void;
};

function stepLabel(step: ShortFlowStepId): string {
  switch (step) {
    case "model":
      return "Model name";
    case "color":
      return "Colour";
    case "storage":
      return "Storage";
    case "battery":
      return "Battery health";
    case "modelNumber":
      return "Model number";
    case "condition":
      return "Condition";
    default:
      return "";
  }
}

export function ShortVerificationFlow({
  profile,
  assetTypeId,
  knowledgeLevel,
  initial,
  onComplete,
}: ShortVerificationFlowProps) {
  const steps = useMemo(
    () => shortStepsForKnowledge(profile, knowledgeLevel),
    [profile, knowledgeLevel],
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [modelName, setModelName] = useState(initial?.modelName ?? "");
  const [color, setColor] = useState(initial?.color);
  const [storage, setStorage] = useState(initial?.storage);
  const [batteryHealth, setBatteryHealth] = useState(initial?.batteryHealth);
  const [modelNumber, setModelNumber] = useState(initial?.modelNumber ?? "");
  const [condition, setCondition] = useState<StructuredCondition>(initial?.condition ?? {});

  const currentStep = steps[stepIndex];
  const hintBrand = inferDeviceHintBrand(modelName, assetTypeId);
  const colours = getColourLibrary(profile.colorLibraryId).colours;

  function buildAnswers(): VerificationAnswers {
    return {
      knowledgeLevel,
      modelName: modelName.trim() || undefined,
      color,
      storage,
      batteryHealth,
      modelNumber: modelNumber.trim() || undefined,
      condition,
      identificationAnswers: {},
    };
  }

  function goNext() {
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
      return;
    }
    onComplete(buildAnswers());
  }

  function goBack() {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Verification {stepIndex + 1} of {steps.length}
        </span>
        <span>{stepLabel(currentStep)}</span>
      </div>

      {currentStep === "model" ? (
        <div className="space-y-3">
          <Label htmlFor="verify-model">What is the model name?</Label>
          <p className="text-xs text-muted-foreground">
            Example: iPhone 14 Pro, MacBook Pro 14 M3, Rolex Submariner Date.
          </p>
          <Input
            id="verify-model"
            placeholder="e.g. iPhone 14 Pro"
            className="h-10 bg-background"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
          />
        </div>
      ) : null}

      {currentStep === "color" ? (
        <ColourSelector colours={colours} value={color} onChange={setColor} />
      ) : null}

      {currentStep === "storage" ? (
        <StorageVerification brand={hintBrand} value={storage} onChange={setStorage} />
      ) : null}

      {currentStep === "battery" ? (
        <BatteryHealthVerification brand={hintBrand} value={batteryHealth} onChange={setBatteryHealth} />
      ) : null}

      {currentStep === "modelNumber" ? (
        <ModelNumberVerification
          brand={hintBrand}
          value={modelNumber}
          onChange={setModelNumber}
          onSkip={() => {
            setModelNumber(SKIP_VALUE);
            goNext();
          }}
        />
      ) : null}

      {currentStep === "condition" ? (
        <StructuredConditionAssessment value={condition} onChange={setCondition} />
      ) : null}

      <div className="flex justify-between gap-3 pt-2">
        <Button type="button" variant="outline" onClick={goBack} disabled={stepIndex === 0}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button type="button" onClick={goNext}>
          {stepIndex < steps.length - 1 ? "Continue" : "Finish verification"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
