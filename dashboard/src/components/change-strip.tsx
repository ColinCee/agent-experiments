import type { ReactNode } from "react";
import type { Range } from "@/data/report";
import { type ChangeWords, changeWords, stripPosition, type Tone } from "@/lib/change";
import { cn } from "@/lib/utils";

const MARK: Record<Tone, string> = { good: "bg-good", bad: "bg-bad", unclear: "bg-muted-foreground" };
const LEAD: Record<Tone, string> = { good: "text-good", bad: "text-bad", unclear: "text-foreground" };

const at = (change: number) => `${stripPosition(change) * 100}%`;

/** Captions over the first strip of a column: where fewer and more mistakes lie. */
function StripAxis() {
  return (
    <div className="relative h-4 text-xs leading-4 text-muted-foreground">
      <span className="absolute left-0">fewer mistakes</span>
      <span className="absolute left-1/2 -translate-x-1/2">no change</span>
      <span className="absolute right-0">more</span>
    </div>
  );
}

/** The marks only, on the fixed -100%..+100% domain; beyond +100% is held at the edge with a "›" cap. */
function Strip({ change, tone }: { change: Range | null; tone: Tone }) {
  const range = change?.low != null && change.high != null ? { low: change.low, high: change.high } : null;
  const clipped = Math.max(change?.value ?? 0, range?.high ?? 0) > 1;
  return (
    <div data-track="change" className="relative h-5 w-full">
      <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
      <div className="absolute top-0 left-1/2 h-full w-px bg-muted-foreground/50" />
      {range && change && (
        <>
          <div
            data-low={range.low}
            data-high={range.high}
            className={cn("absolute top-1/2 h-1 -translate-y-1/2 rounded-full", MARK[tone])}
            style={{ left: at(range.low), width: `calc(${at(range.high)} - ${at(range.low)})` }}
          />
          <div
            data-value={change.value}
            className={cn(
              "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card",
              MARK[tone],
            )}
            style={{ left: at(change.value) }}
          />
          {clipped && (
            <span
              aria-hidden
              className={cn("absolute top-1/2 -right-2.5 -translate-y-1/2 text-sm leading-none font-bold", LEAD[tone])}
            >
              ›
            </span>
          )}
        </>
      )}
    </div>
  );
}

function Words({ words, inline = false }: { words: ChangeWords; inline?: boolean }) {
  return (
    <div className="min-w-0 leading-snug">
      <span className={cn("font-semibold", LEAD[words.tone])}>{words.lead}</span>
      {words.hint && (
        <span className={cn("text-sm text-muted-foreground", inline ? "ml-2" : "block")}>{words.hint}</span>
      )}
    </div>
  );
}

/** The words for a change without its strip, on one line. */
export function ChangeText({ change }: { change: Range | null }) {
  return <Words words={changeWords(change)} inline />;
}

/** Lays `children` out exactly as a strip is laid out, so a rate track above a strip has the strip's width. */
export function AlignWithStrip({ children }: { children: ReactNode }) {
  return (
    <div className="@container">
      <div className="grid gap-x-5 @min-[27rem]:grid-cols-[minmax(0,1fr)_9.5rem]">
        <div className="pr-2.5">{children}</div>
      </div>
    </div>
  );
}

/**
 * A change in the mistake rate with its 90% range, and the words for it. Every strip in a column comes from here so
 * they share one scale; `axis` puts the captions over the first one.
 */
export function ChangeStrip({ change, axis = false }: { change: Range | null; axis?: boolean }) {
  const words = changeWords(change);
  return (
    // Words go beside the strip only when that leaves the strip room for its captions; otherwise below it.
    <div className="@container">
      <div className="grid items-center gap-x-5 gap-y-1 @min-[27rem]:grid-cols-[minmax(0,1fr)_9.5rem]">
        {axis && (
          <div className="pr-2.5 @min-[27rem]:col-start-1">
            <StripAxis />
          </div>
        )}
        <div className="pr-2.5 @min-[27rem]:col-start-1">
          <Strip change={change} tone={words.tone} />
        </div>
        <Words words={words} />
      </div>
    </div>
  );
}
