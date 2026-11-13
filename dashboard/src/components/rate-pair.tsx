import { type ReactNode, useState } from "react";
import { percent } from "@/lib/format";
import { layoutPair } from "@/lib/pair-labels";
import { cn } from "@/lib/utils";
import { textWidth, useWidth } from "./measure";

/** with = blue, without = grey, everywhere: with the rule, since the rule, the new wording. */
export type Side = "with" | "without";

const DOT = { with: "bg-with", without: "bg-without" } as const;

const at = (rate: number) => `${Math.min(1, Math.max(0, rate)) * 100}%`;

/**
 * The fixed 0–100% track every rate is drawn on, so rows line up to the pixel. Padded by a dot's radius at each end,
 * so a dot at 0% or 100% draws whole.
 */
function RateTrack({
  children,
  trackRef,
}: {
  children: ReactNode;
  trackRef?: (element: HTMLDivElement | null) => void;
}) {
  return (
    <div className="px-1.5">
      <div ref={trackRef} data-track="rate" className="relative h-5 w-full">
        <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
        <div className="absolute top-1/2 left-0 h-2 w-px -translate-y-1/2 bg-border" />
        <div className="absolute top-1/2 right-0 h-2 w-px -translate-y-1/2 bg-border" />
        {children}
      </div>
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

const LABEL_SIZE = 14;
const LABEL_WEIGHT = 500;
const TEXT = { with: "text-with", without: "text-without" } as const;

/** A label's width with a little to spare: the canvas cannot apply the page's tabular figures, which run wider. */
const labelWidth = (text: string) => textWidth(text, LABEL_SIZE, LABEL_WEIGHT) * 1.08 + 2;

/** The line from before to since with an arrowhead at since, stopping short of both dots; none when they touch. */
function Arrow({ from, to }: { from: number; to: number }) {
  const dir = Math.sign(to - from);
  if (Math.abs(to - from) < 18) return null;
  const [x1, x2] = [from + dir * 6, to - dir * 7];
  const tip = x2 + dir * 1;
  return (
    <svg data-line aria-hidden className="pointer-events-none absolute inset-y-0 left-0 h-full w-full overflow-visible">
      <line x1={x1} x2={x2 - dir * 4} y1="50%" y2="50%" className="stroke-muted-foreground" strokeWidth={1.5} />
      <polygon points={`${tip},10 ${tip - dir * 5},6.5 ${tip - dir * 5},13.5`} className="fill-muted-foreground" />
    </svg>
  );
}

/**
 * Before or without (grey) and since or with (blue) the rule on one 0–100% track. Plain, the dots are joined by a thin
 * line; `labelled`, the line becomes an arrow towards since and each number is written beside its dot (see
 * `layoutPair` for where), so the pair needs no columns of numbers. A missing side draws no dot.
 */
export function RatePair({
  without,
  withRule,
  labelled = false,
}: {
  without: number | null;
  withRule: number | null;
  labelled?: boolean;
}) {
  const [track, setTrack] = useState<HTMLDivElement | null>(null);
  const width = useWidth(labelled ? track : null);
  const labels = labelled && width > 0 ? layoutPair(without, withRule, width, labelWidth) : [];
  return (
    <RateTrack trackRef={setTrack}>
      {without !== null && withRule !== null && !labelled && (
        <div
          className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-muted-foreground/70"
          style={{ left: at(Math.min(without, withRule)), width: at(Math.abs(without - withRule)) }}
        />
      )}
      {labelled && width > 0 && without !== null && withRule !== null && (
        <Arrow from={without * width} to={withRule * width} />
      )}
      {without !== null && <Dot rate={without} side="without" />}
      {withRule !== null && <Dot rate={withRule} side="with" />}
      {labels.map((label) => (
        <span
          key={label.parts.map((p) => p.text).join("")}
          data-label
          className={cn(
            "absolute text-sm leading-none font-medium whitespace-nowrap",
            label.below ? "top-[calc(50%+3px)]" : "top-1/2 -translate-y-1/2",
          )}
          style={{ left: label.left }}
        >
          {label.parts.map((part) => (
            <span key={part.text} className={part.side ? TEXT[part.side] : "text-muted-foreground"}>
              {part.text}
            </span>
          ))}
        </span>
      ))}
    </RateTrack>
  );
}

/** One grey rate as a bar from 0, for a mistake with no rule yet, its number just past the bar's end. */
export function RateBar({ rate }: { rate: number }) {
  const [track, setTrack] = useState<HTMLDivElement | null>(null);
  const width = useWidth(track);
  const text = percent(rate);
  // Past the end when it fits; a bar near 100% has its number held at the track's end instead.
  const left = Math.min(rate * width + 4, width - labelWidth(text));
  return (
    <RateTrack trackRef={setTrack}>
      <div
        className="absolute top-1/2 left-0 h-2 -translate-y-1/2 rounded-r-sm bg-without"
        style={{ width: at(rate) }}
      />
      <div data-rate={rate} data-side="without" className="absolute top-1/2 size-0" style={{ left: at(rate) }} />
      {width > 0 && (
        <span
          data-label
          className="absolute top-1/2 -translate-y-1/2 text-sm leading-none font-medium whitespace-nowrap text-without"
          style={{ left }}
        >
          {text}
        </span>
      )}
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

/** The legend of a labelled pair, said once: which side is grey, which is blue, and which way the arrow runs. */
export function PairLegend({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
      <Swatch side="without">{from}</Swatch>
      <span aria-hidden>→</span>
      <Swatch side="with">{to}</Swatch>
    </div>
  );
}
