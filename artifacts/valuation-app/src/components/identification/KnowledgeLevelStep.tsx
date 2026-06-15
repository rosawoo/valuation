import { cn } from "@/lib/utils";
import type { KnowledgeLevel } from "@/lib/identification/types";

const OPTIONS: { value: KnowledgeLevel; label: string; description: string }[] = [
  {
    value: "exact",
    label: "Yes, I know exactly what it is",
    description: "You can name the model and most specs — we'll ask a shorter verification set.",
  },
  {
    value: "unsure",
    label: "I am not sure",
    description: "You have a rough idea but want help confirming the exact variant.",
  },
  {
    value: "unknown",
    label: "I have no idea",
    description: "We'll guide you step by step to identify the item before valuing it.",
  },
];

type KnowledgeLevelStepProps = {
  value?: KnowledgeLevel;
  onChange: (level: KnowledgeLevel) => void;
};

export function KnowledgeLevelStep({ value, onChange }: KnowledgeLevelStepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Verifying your item before valuation improves accuracy — we match the right comps and specs.
      </p>
      <p className="text-sm font-medium">Do you know exactly what item you have?</p>
      <div className="grid gap-3">
        {OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "rounded-xl border p-4 text-left transition-all",
                active
                  ? "border-accent bg-accent/10 ring-2 ring-accent/40"
                  : "border-border bg-background hover:border-accent/50",
              )}
            >
              <div className="font-medium">{opt.label}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{opt.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
