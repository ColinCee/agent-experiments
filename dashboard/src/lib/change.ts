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

/** "likely 74% to 89% fewer", or "likely 100% fewer" when both ends round alike. */
function likely(from: number, to: number, side: "fewer" | "more"): string {
  const [a, b] = [percent(from), percent(to)];
  return a === b ? `likely ${a} ${side}` : `likely ${a} to ${b} ${side}`;
}

/** How a change in the mistake rate and its 90% range read on screen; lower is better. */
export function changeWords(change: Range | null): ChangeWords {
  if (change?.low == null || change.high == null) {
    return { tone: "unclear", lead: "Too few tasks to tell", hint: null, hasRange: false };
  }
  const tone = changeTone(change);
  if (tone === "good") {
    return {
      tone,
      lead: `${percent(-change.value)} fewer`,
      hint: likely(-change.high, -change.low, "fewer"),
      hasRange: true,
    };
  }
  if (tone === "bad") {
    return {
      tone,
      lead: `${percent(change.value)} more`,
      hint: likely(change.low, change.high, "more"),
      hasRange: true,
    };
  }
  return { tone, lead: "Unclear", hint: "could be no change", hasRange: true };
}

/** The change in a few words for a line of text: "52% more", "could be no change". */
export function changeInBrief(change: Range | null): string {
  const words = changeWords(change);
  if (!words.hasRange) return "too few tasks to tell";
  return words.tone === "unclear" ? "could be no change" : words.lead;
}

/** Where a change sits on a strip from -100% (left, 0) to +100% (right, 1); beyond +100% is held at the edge. */
export function stripPosition(change: number): number {
  return (Math.min(1, Math.max(-1, change)) + 1) / 2;
}
