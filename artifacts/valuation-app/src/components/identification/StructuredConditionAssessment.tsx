import { QuestionOptionGroup } from "./QuestionOptionGroup";
import type { StructuredCondition } from "@/lib/identification/types";

const SCREEN_OPTIONS = [
  { value: "Perfect", label: "Perfect" },
  { value: "Minor Scratches", label: "Minor scratches" },
  { value: "Moderate Scratches", label: "Moderate scratches" },
  { value: "Cracked", label: "Cracked" },
];

const BODY_OPTIONS = [
  { value: "Excellent", label: "Excellent" },
  { value: "Good", label: "Good" },
  { value: "Fair", label: "Fair" },
  { value: "Poor", label: "Poor" },
];

const BATTERY_OPTIONS = [
  { value: "Above 90%", label: "Above 90%" },
  { value: "80 to 89%", label: "80% – 89%" },
  { value: "Below 80%", label: "Below 80%" },
  { value: "Unknown", label: "Unknown" },
];

const REPAIR_OPTIONS = [
  { value: "No Repairs", label: "No repairs" },
  { value: "Screen Replacement", label: "Screen replacement" },
  { value: "Battery Replacement", label: "Battery replacement" },
  { value: "Other", label: "Other repair" },
];

type StructuredConditionAssessmentProps = {
  value: StructuredCondition;
  onChange: (next: StructuredCondition) => void;
};

export function StructuredConditionAssessment({ value, onChange }: StructuredConditionAssessmentProps) {
  return (
    <div className="space-y-8">
      <QuestionOptionGroup
        prompt="Screen condition"
        whyItHelps="Screen defects are the first thing buyers discount."
        options={SCREEN_OPTIONS}
        value={value.screen}
        onChange={(v) => onChange({ ...value, screen: v })}
        layout="grid"
      />
      <QuestionOptionGroup
        prompt="Body / case condition"
        whyItHelps="Dents and wear affect cosmetic grade and listing photos."
        options={BODY_OPTIONS}
        value={value.body}
        onChange={(v) => onChange({ ...value, body: v })}
        layout="grid"
      />
      <QuestionOptionGroup
        prompt="Battery condition"
        whyItHelps="Battery wear signals how long the device will hold value."
        options={BATTERY_OPTIONS}
        value={value.battery}
        onChange={(v) => onChange({ ...value, battery: v })}
        layout="grid"
      />
      <QuestionOptionGroup
        prompt="Repairs"
        whyItHelps="Third-party repairs can affect warranty and buyer trust."
        options={REPAIR_OPTIONS}
        value={value.repairs}
        onChange={(v) => onChange({ ...value, repairs: v })}
        layout="grid"
      />
    </div>
  );
}
