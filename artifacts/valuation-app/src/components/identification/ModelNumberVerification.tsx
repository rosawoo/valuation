import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DeviceHintCard } from "./DeviceHintCard";
import { modelNumberHintForBrand } from "@/lib/identification/device-hints";
import type { DeviceHintBrand } from "@/lib/identification/device-hints";
import { SKIP_VALUE } from "@/lib/identification/types";

type ModelNumberVerificationProps = {
  brand: DeviceHintBrand;
  value?: string;
  onChange: (value: string) => void;
  onSkip: () => void;
};

export function ModelNumberVerification({ brand, value, onChange, onSkip }: ModelNumberVerificationProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="model-number">Model number (optional but recommended)</Label>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          The model number is the most precise identifier — it confirms region, band, and exact variant for
          valuation.
        </p>
        <Input
          id="model-number"
          placeholder="e.g. A2890"
          className="mt-2 h-10 bg-background"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <DeviceHintCard hint={modelNumberHintForBrand(brand)} />
      <Button type="button" variant="ghost" size="sm" onClick={() => onSkip()}>
        Skip for now
      </Button>
    </div>
  );
}

export function modelNumberSkipped(value: string | undefined): boolean {
  return value === SKIP_VALUE || value === "";
}
