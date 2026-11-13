import type { Day, Mistake, MistakeChange } from "@/data/report";
import { changeTone, missingChange, type Tone } from "./change";
import { dayLabel, percent, plural } from "./format";

export function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const withRule = (mistakes: Mistake[]) => mistakes.filter((m) => m.rule !== null);
export const withoutRule = (mistakes: Mistake[]) => mistakes.filter((m) => m.rule === null);

const TONE_ORDER: Record<Tone, number> = { good: 0, unclear: 1, bad: 2 };

/** Clearly fewer (largest first), then unclear, then clearly more (smallest first). */
export function sortByChange(mistakes: Mistake[]): Mistake[] {
  const tone = (m: Mistake) => TONE_ORDER[changeTone(m.change)];
  return mistakes.toSorted((a, b) => tone(a) - tone(b) || (a.change?.value ?? 0) - (b.change?.value ?? 0));
}

/** The line under a mistake's chart: its latest rule and since when, or null with no rule. */
export function ruleSince(mistake: Mistake, day: Day): string | null {
  return mistake.rule && `Rule since ${dayLabel(mistake.rule.day, day)}: ${mistake.rule.what}`;
}

/** What a marker on the history chart says when hovered or tapped. */
export function markerWords(change: MistakeChange, day: Day): string {
  const when = dayLabel(change.day, day);
  return change.kind === "trial" ? `Trial started ${when}` : `Rule changed ${when}: ${change.what}`;
}

/** The chip beside a mistake's name, only when its rate on the report day is outside its usual range. */
export function todayChip(mistake: Mistake): { text: string; tone: "good" | "bad" } | null {
  const today = mistake.today;
  if (!today?.outside) return null;
  const numbers = `${percent(today.rate)}, usually ${percent(today.usual_low)} to ${percent(today.usual_high)}`;
  return today.outside === "above"
    ? { text: `Above usual today: ${numbers}`, tone: "bad" }
    : { text: `Below usual today: ${numbers}`, tone: "good" };
}

/** "79 tasks before · 103 since". */
export function ruleTasks(mistake: Mistake): string {
  return `${plural(mistake.before?.tasks ?? 0, "task")} before · ${mistake.after?.tasks ?? 0} since`;
}

/** A mistake with no rule: its rate now and what it rests on. */
export function currentWords(mistake: Mistake, day: Day): { rate: string; tasks: string } | null {
  if (mistake.current === null) return null;
  return {
    rate: `${percent(mistake.current.rate)} now`,
    tasks: `${plural(mistake.current.tasks, "task")} since ${dayLabel(mistake.current.from, day)}`,
  };
}

export const NO_RECENT_TASKS = "No tasks in the last 4 weeks";

/**
 * The history chart's rows: the rate split into `before` (up to and including the latest rule change) and `after`
 * (from it), so the two lines meet on the change day and the colour switches exactly there.
 */
export function historyRows(mistake: Mistake): { day: Day; before: number | null; after: number | null }[] {
  const ruleDay = mistake.rule?.day;
  return mistake.series.map(({ day, rate }) => ({
    day,
    before: ruleDay === undefined || day <= ruleDay ? rate : null,
    after: ruleDay !== undefined && day >= ruleDay ? rate : null,
  }));
}

/** Rule changes and trial starts grouped by day, so changes on one day share one marker. */
export function changesByDay(changes: MistakeChange[]): { day: Day; changes: MistakeChange[] }[] {
  const days = new Map<Day, MistakeChange[]>();
  for (const change of changes) days.set(change.day, [...(days.get(change.day) ?? []), change]);
  return [...days].map(([day, all]) => ({ day, changes: all }));
}

/** What a mistake's missing before/since change means: too few tasks, or no mistakes before the rule. */
export const missingMistakeChange = (mistake: Mistake) =>
  missingChange(Math.min(mistake.before?.tasks ?? 0, mistake.after?.tasks ?? 0), "before the rule");
