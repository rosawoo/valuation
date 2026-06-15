import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { QuestionOptionGroup } from "./QuestionOptionGroup";
import { DeviceHintCard } from "./DeviceHintCard";
import { batteryHintForBrand } from "@/lib/identification/device-hints";
import type { DeviceHintBrand } from "@/lib/identification/device-hints";
import { SKIP_VALUE, UNKNOWN_VALUE } from "@/lib/identification/types";
import { useState } from "react";

const BAND_OPTIONS = [
  { value: "90+", label: "90% or above" },
  { value: "80-89", label: "80% – 89%" },
  { value: "below-80", label: "Below 80%" },
];

type BatteryHealthVerificationProps = {
  brand: DeviceHintBrand;
  value?: string;
  onChange: (value: string) => void;
};

export function BatteryHealthVerification({ brand, value, onChange }: BatteryHealthVerificationProps) {
  const [exactMode, setExactMode] = useState(false);
  const showHint = value === UNKNOWN_VALUE;

  if (exactMode) {
    return (
      <div className="space-y-4">
        <div>
          <Label htmlFor="battery-exact">Battery health percentage</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Enter the exact % from Settings if you have it — this sharpens your valuation.
          </p>
          <Input
            id="battery-exact"
            type="number"
            min={1}
            max={100}
            placeholder="e.g. 92"
            className="mt-2 h-10 bg-background"
            value={value && !["90+", "80-89", "below-80", UNKNOWN_VALUE, SKIP_VALUE].includes(value) ? value : ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(UNKNOWN_VALUE)}>
            I do not know
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setExactMode(false)}>
            Use ranges instead
          </Button>
        </div>
        {showHint ? <DeviceHintCard hint={batteryHintForBrand(brand)} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <QuestionOptionGroup
        prompt="What is the battery health percentage?"
        whyItHelps="Battery health directly affects resale value — buyers discount phones below 85%."
        options={BAND_OPTIONS}
        value={value}
        onChange={onChange}
        layout="grid"
      />
      <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => setExactMode(true)}>
        I know the exact percentage
      </Button>
      {showHint ? <DeviceHintCard hint={batteryHintForBrand(brand)} /> : null}
    </div>
  );
}
