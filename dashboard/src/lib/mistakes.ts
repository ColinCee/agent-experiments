import type { Day, Mistake } from "@/data/report";
import { changeTone, type Tone } from "./change";
import { dayLabel, percent, plural } from "./format";

const TRIAL_START = "trial started: ";

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

/**
 * A rule change in words, with its date: "Rule since 8 Nov: …" for the mistake's latest, "Rule changed 1 Oct: …" for
 * an earlier one, or "Trial started 8 Nov" for a trial's start.
 */
export function ruleLine(change: { day: Day; what: string }, mistake: Mistake, day: Day): string {
  const when = dayLabel(change.day, day);
  if (change.what.startsWith(TRIAL_START)) return `Trial started ${when}`;
  const latest = change.day === mistake.rule?.day && change.what === mistake.rule.what;
  return `${latest ? "Rule since" : "Rule changed"} ${when}: ${change.what}`;
}

/** The chip beside a mistake's name, only when its rate on the report day is outside its usual range. */
export function todayChip(mistake: Mistake): { text: string; tone: "good" | "bad" } | null {
  if (mistake.today?.outside === "above") return { text: "Above usual today", tone: "bad" };
  if (mistake.today?.outside === "below") return { text: "Below usual today", tone: "good" };
  return null;
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
