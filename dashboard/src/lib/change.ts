import type { Range } from "@/data/report";
import { percent } from "./format";

/** good: the whole range is below no change; bad: the whole range is above it; unclear: it may be no change. */
export type Tone = "good" | "bad" | "unclear";

/** A status badge: good works, bad needs attention, unclear is an outline, waiting an outline with a dot. */
export type BadgeTone = "good" | "bad" | "unclear" | "waiting";

export interface ChangeWords {
  tone: Tone;
  /** The bold words: "83% fewer", "Unclear". */
  lead: string;
  /** The secondary words, or null when the lead says it all. */
  hint: string | null;
  /** False when there were too few tasks to draw a range. */
  hasRange: boolean;
}

export function changeTone(change: Range | null): Tone {
  if (change?.low == null || change.high == null) return "unclear";
  if (change.high < 0) return "good";
  if (change.low > 0) return "bad";
  return "unclear";
}

/** "likely 74% to 89% fewer"; null when both ends round to the lead's own number, which would only repeat it. */
function likely(lead: number, from: number, to: number, side: "fewer" | "more"): string | null {
  const [l, a, b] = [percent(lead), percent(from), percent(to)];
  if (a === b) return a === l ? null : `likely ${a} ${side}`;
  return `likely ${a} to ${b} ${side}`;
}

/** One end of a range in words: "40% fewer", "12% more", "no change". */
function end(x: number): string {
  const p = percent(Math.abs(x));
  return p === "0%" ? "no change" : x < 0 ? `${p} fewer` : `${p} more`;
}

/** A range in words from its fewer end to its more end: "40% fewer to 12% more". */
export function rangeWords(change: Range): string | null {
  return change.low == null || change.high == null ? null : `${end(change.low)} to ${end(change.high)}`;
}

export type ChangeMode = "plain" | "slipping" | "untrusted";

/**
 * How a change in the mistake rate and its 90% range read on screen; lower is better. A `slipping` proven rule reads
 * "Little or no change" in red whatever the range; an `untrusted` replay keeps its words but loses its colour.
 */
export function changeWords(change: Range | null, mode: ChangeMode = "plain"): ChangeWords {
  if (change?.low == null || change.high == null) {
    return { tone: "unclear", lead: "Too few tasks to tell", hint: null, hasRange: false };
  }
  if (mode === "slipping")
    return { tone: "bad", lead: "Little or no change", hint: rangeWords(change), hasRange: true };
  const tone = changeTone(change);
  const words: ChangeWords =
    tone === "good"
      ? {
          tone,
          lead: `${percent(-change.value)} fewer`,
          hint: likely(-change.value, -change.high, -change.low, "fewer"),
          hasRange: true,
        }
      : tone === "bad"
        ? {
            tone,
            lead: `${percent(change.value)} more`,
            hint: likely(change.value, change.low, change.high, "more"),
            hasRange: true,
          }
        : { tone, lead: "Unclear", hint: rangeWords(change), hasRange: true };
  return mode === "untrusted" ? { ...words, tone: "unclear" } : words;
}

/** True when the change or its range goes past +100%, the strip's right edge, so the strip shows a cap there. */
export function isClipped(change: Range | null): boolean {
  return Math.max(change?.value ?? 0, change?.high ?? 0) > 1;
}

/** Where a change sits on a strip from -100% (left, 0) to +100% (right, 1); beyond +100% is held at the edge. */
export function stripPosition(change: number): number {
  return (Math.min(1, Math.max(-1, change)) + 1) / 2;
}
