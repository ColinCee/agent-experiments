import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** with = blue, without = grey, everywhere: with the rule, since the rule, the new wording. */
export type Side = "with" | "without";

const DOT = { with: "bg-with", without: "bg-without" } as const;

const at = (rate: number) => `${Math.min(1, Math.max(0, rate)) * 100}%`;

/** The fixed 0–100% track every rate is drawn on, so rows line up to the pixel. */
function RateTrack({ children }: { children: ReactNode }) {
  return (
    <div data-track="rate" className="relative h-5 w-full">
      <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
      <div className="absolute top-1/2 left-0 h-2 w-px -translate-y-1/2 bg-border" />
      <div className="absolute top-1/2 right-0 h-2 w-px -translate-y-1/2 bg-border" />
      {children}
    </div>
  );
}

function Dot({ rate, side }: { rate: number; side: Side }) {
  return (
    <div
      data-rate={rate}
      data-side={side}
      className={cn("absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full", DOT[side])}
      style={{ left: at(rate) }}
    />
  );
}

/** Without (grey) and with (blue) the rule on one track, joined by a thin line; a missing side draws no dot. */
export function RatePair({ without, withRule }: { without: number | null; withRule: number | null }) {
  return (
    <RateTrack>
      {without !== null && withRule !== null && (
        <div
          className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-muted-foreground/70"
          style={{ left: at(Math.min(without, withRule)), width: at(Math.abs(without - withRule)) }}
        />
      )}
      {without !== null && <Dot rate={without} side="without" />}
      {withRule !== null && <Dot rate={withRule} side="with" />}
    </RateTrack>
  );
}

/** One grey rate as a bar from 0, for a mistake with no rule yet. */
export function RateBar({ rate }: { rate: number }) {
  return (
    <RateTrack>
      <div
        className="absolute top-1/2 left-0 h-2 -translate-y-1/2 rounded-r-sm bg-without"
        style={{ width: at(rate) }}
      />
      <div data-rate={rate} data-side="without" className="absolute top-1/2 size-0" style={{ left: at(rate) }} />
    </RateTrack>
  );
}

/** A rate in its side's colour, as written at the ends of a row. */
export function RateValue({ rate, side, className }: { rate: string; side: Side; className?: string }) {
  return <span className={cn("font-semibold", side === "with" ? "text-with" : "text-without", className)}>{rate}</span>;
}

/** A label with its side's swatch: a column header that is also the legend. */
export function Swatch({ side, children }: { side: Side; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2.5 shrink-0 rounded-full", DOT[side])} />
      {children}
    </span>
  );
}
