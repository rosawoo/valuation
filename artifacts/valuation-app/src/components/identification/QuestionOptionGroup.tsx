import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SKIP_VALUE, UNKNOWN_VALUE } from "@/lib/identification/types";

type QuestionOptionGroupProps = {
  prompt: string;
  whyItHelps?: string;
  options: { value: string; label: string }[];
  value?: string;
  onChange: (value: string) => void;
  layout?: "list" | "grid";
};

export function QuestionOptionGroup({
  prompt,
  whyItHelps,
  options,
  value,
  onChange,
  layout = "list",
}: QuestionOptionGroupProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium leading-snug">{prompt}</p>
        {whyItHelps ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{whyItHelps}</p>
        ) : null}
      </div>
      <div
        className={cn(
          layout === "grid" ? "grid grid-cols-1 gap-2 sm:grid-cols-2" : "flex flex-col gap-2",
        )}
      >
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "rounded-xl border px-4 py-3 text-left text-sm transition-all",
                active
                  ? "border-accent bg-accent/10 ring-2 ring-accent/30"
                  : "border-border bg-background hover:border-accent/50",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(UNKNOWN_VALUE)}>
          I do not know
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(SKIP_VALUE)}>
          Skip
        </Button>
      </div>
    </div>
  );
}
