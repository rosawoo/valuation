import { QuestionOptionGroup } from "./QuestionOptionGroup";
import { DeviceHintCard } from "./DeviceHintCard";
import { storageHintForBrand } from "@/lib/identification/device-hints";
import type { DeviceHintBrand } from "@/lib/identification/device-hints";
import { UNKNOWN_VALUE } from "@/lib/identification/types";

const STORAGE_OPTIONS = [
  { value: "64GB", label: "64 GB" },
  { value: "128GB", label: "128 GB" },
  { value: "256GB", label: "256 GB" },
  { value: "512GB", label: "512 GB" },
  { value: "1TB", label: "1 TB" },
];

type StorageVerificationProps = {
  brand: DeviceHintBrand;
  value?: string;
  onChange: (value: string) => void;
};

export function StorageVerification({ brand, value, onChange }: StorageVerificationProps) {
  const showHint = value === UNKNOWN_VALUE;
  return (
    <div className="space-y-4">
      <QuestionOptionGroup
        prompt="What storage size does your device have?"
        whyItHelps="Storage tier is one of the biggest price drivers — a 256 GB model often sells for noticeably more than 128 GB."
        options={STORAGE_OPTIONS}
        value={value}
        onChange={onChange}
        layout="grid"
      />
      {showHint ? <DeviceHintCard hint={storageHintForBrand(brand)} /> : null}
    </div>
  );
}
