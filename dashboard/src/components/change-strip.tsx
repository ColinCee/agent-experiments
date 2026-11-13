import type { ReactNode } from "react";
import type { Range } from "@/data/report";
import { type ChangeMode, type ChangeWords, changeWords, isClipped, stripPosition, type Tone } from "@/lib/change";
import { cn } from "@/lib/utils";

const MARK: Record<Tone, string> = { good: "bg-good", bad: "bg-bad", unclear: "bg-muted-foreground" };
const LEAD: Record<Tone, string> = { good: "text-good", bad: "text-bad", unclear: "text-foreground" };

const at = (change: number) => `${stripPosition(change) * 100}%`;

/** Captions over a strip: fewer and more mistakes either side of the centre, which names what is compared against. */
export function StripAxis({ same }: { same: string }) {
  return (
    <div data-axis className="relative mx-1.5 h-4 text-xs leading-4 text-muted-foreground">
      <span className="absolute left-0">fewer</span>
      <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{same}</span>
      <span className="absolute right-0">more</span>
    </div>
  );
}

/**
 * The marks only, on the fixed -100%..+100% domain, padded by a dot's radius at each end so a dot at either edge draws
 * whole; beyond +100% the dot is held at the edge with an arrowhead after it.
 */
function Strip({ change, tone }: { change: Range | null; tone: Tone }) {
  const range = change?.low != null && change.high != null ? { low: change.low, high: change.high } : null;
  const clipped = isClipped(change);
  return (
    <div className="px-1.5">
      <div data-track="change" className="relative h-5 w-full">
        <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
        <div className="absolute top-0 left-1/2 h-full w-px bg-muted-foreground/70" />
        {range && change && (
          <>
            <div
              data-low={range.low}
              data-high={range.high}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 rounded-full",
                tone === "unclear" ? "h-0.5" : "h-1",
                MARK[tone],
              )}
              style={{ left: at(range.low), width: `calc(${at(range.high)} - ${at(range.low)})` }}
            />
            <div
              data-value={change.value}
              className={cn(
                "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card",
                // Hollow when unclear, so it never reads as the solid grey dot of "without the rule".
                tone === "unclear" ? "border-2 border-muted-foreground bg-card" : MARK[tone],
              )}
              style={{ left: at(change.value) }}
            />
            {clipped && (
              <span
                data-off-scale
                aria-hidden
                className={cn(
                  "absolute top-1/2 left-full ml-2 -translate-y-1/2 border-y-4 border-l-[6px] border-y-transparent border-l-current",
                  LEAD[tone],
                )}
              />
            )}
          </>
        )}
      </div>
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

/** A strip's marks alone, for a page that writes the change's words itself. */
export function ChangeMarks({ change, tone }: { change: Range | null; tone: Tone }) {
  return <Strip change={change} tone={tone} />;
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

/** The captions in a table's header row, over the column of strips below it. */
export function StripAxisCell({ same }: { same: string }) {
  return (
    <div className="pr-2.5">
      <StripAxis same={same} />
    </div>
  );
}

/**
 * A change in the mistake rate with its 90% range, and the words for it. Every strip in a column comes from here so
 * they share one scale. On phones every strip has its captions; on wider screens only an `axis` strip does, and in a
 * table row (`cells`), where the strip and its words become the row's own cells, the header row has them instead.
 */
export function ChangeStrip({
  change,
  axis = false,
  mode = "plain",
  cells = false,
  missing,
  same,
}: {
  change: Range | null;
  /** The centre caption, naming what the change is against: "same as without". */
  same: string;
  axis?: boolean;
  mode?: ChangeMode;
  cells?: boolean;
  /** What to say when the report has no change (null); too few tasks unless told otherwise. */
  missing?: string;
}) {
  const words = changeWords(change, mode, missing);
  return (
    // Words go beside the strip only when that leaves the strip room for its captions; otherwise below it.
    <div className={cn("@container", cells && "md:contents")}>
      <div
        className={cn(
          "grid items-center gap-x-5 gap-y-1 @min-[27rem]:grid-cols-[minmax(0,1fr)_9.5rem]",
          cells && "md:contents",
        )}
      >
        {/* Every phone card carries its own captions, since the first scrolls away; wider screens show them once. */}
        <div className={cn("pr-2.5 @min-[27rem]:col-start-1", (cells || !axis) && "md:hidden")}>
          <StripAxis same={same} />
        </div>
        <div className="pr-2.5 @min-[27rem]:col-start-1">
          <Strip change={change} tone={words.tone} />
        </div>
        <Words words={words} />
      </div>
    </div>
  );
}
