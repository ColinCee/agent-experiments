import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Day, Report } from "@/data/report";
import { changeWords } from "./change";
import { dayLabel, percent } from "./format";
import { finishedOn, verdictWords } from "./trials";

export interface AttentionItem {
  /** bad needs him; good is news (a trial that works); neutral is news with no good or bad in it. */
  tone: "bad" | "good" | "neutral";
  title: string;
  detail: string;
}

/** A trial that finished within this many days is news on the overview. */
const RECENT_DAYS = 7;

/**
 * What the overview puts first, most serious first: mistakes above their usual range on the report day (furthest
 * above first), proven rules that are slipping, then trials that finished lately. A mistake below its usual range is
 * good news and not listed.
 */
export function attentionItems(report: Report): AttentionItem[] {
  const above = report.mistakes
    .flatMap((m) => (m.today?.outside === "above" ? [{ name: m.name, today: m.today }] : []))
    .toSorted((a, b) => b.today.rate / b.today.usual_high - a.today.rate / a.today.usual_high)
    .map(
      ({ name, today }): AttentionItem => ({
        tone: "bad",
        title: name,
        detail: `${percent(today.rate)} on ${dayLabel(report.day, report.day)} · usually ${percent(today.usual_low)} to ${percent(today.usual_high)}`,
      }),
    );
  const slipping = report.permanent
    .filter((p) => p.slipping)
    .map(
      (p): AttentionItem => ({
        tone: "bad",
        title: p.name,
        detail: `Rule no longer cuts this mistake · ${changeWords(p.change, "slipping").hint ?? "too few tasks to tell"}`,
      }),
    );
  const finished = report.trials
    .filter((t) => {
      if (t.state !== "finished") return false;
      const ago = differenceInCalendarDays(parseISO(report.day), parseISO(finishedOn(t)));
      return ago >= 0 && ago < RECENT_DAYS;
    })
    .map(
      (t): AttentionItem => ({
        tone: t.verdict === "works" ? "good" : "neutral",
        title: t.name,
        detail: `Trial finished: ${verdictWords(t.verdict).toLowerCase()}`,
      }),
    );
  return [...above, ...slipping, ...finished];
}

/** How many items need him, for the count beside Overview in the sidebar. */
export const needsHim = (items: AttentionItem[]) => items.filter((i) => i.tone === "bad").length;

/** The one calm line when nothing needs him. */
export function calmLine(day: Day): string {
  return `Nothing needs attention. No mistake was above its usual range on ${dayLabel(day, day)} and no proven rule is slipping.`;
}
