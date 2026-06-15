import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColourOption } from "@/lib/identification/color-libraries";
import { UNKNOWN_VALUE } from "@/lib/identification/types";

type ColourSelectorProps = {
  colours: ColourOption[];
  value?: string;
  onChange: (colourName: string) => void;
  label?: string;
};

export function ColourSelector({ colours, value, onChange, label = "Colour" }: ColourSelectorProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">
        Exact colour helps match the right resale listing — buyers filter by shade.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {colours.map((c) => {
          const active = value === c.name;
          const isGradient = c.hex.startsWith("linear-gradient");
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c.name)}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                active
                  ? "border-accent bg-accent/10 ring-2 ring-accent/40"
                  : "border-border bg-background hover:border-accent/50",
              )}
            >
              <span
                className="h-8 w-8 shrink-0 rounded-full border border-border/60 shadow-inner"
                style={{ background: c.hex }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium leading-tight">{c.name}</span>
                <span
                  className="mt-1 block h-2 w-full rounded-full border border-border/40"
                  style={{ background: isGradient ? undefined : c.hex }}
                  aria-hidden
                />
              </span>
              {active ? <Check className="h-4 w-4 shrink-0 text-accent" /> : null}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onChange(UNKNOWN_VALUE)}
          className={cn(
            "col-span-2 flex items-center justify-center rounded-xl border border-dashed p-3 text-sm text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground sm:col-span-3",
            value === UNKNOWN_VALUE && "border-accent bg-accent/5 text-foreground",
          )}
        >
          I do not know
        </button>
      </div>
    </div>
  );
}
