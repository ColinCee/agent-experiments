import type { Day, Mistake, MistakeChange } from "@/data/report";
import { type ChangeWords, changeTone, changeWords, FEWEST_TASKS, missingChange, type Tone } from "./change";
import { dayLabel, fewTasks } from "./format";

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

/** What a marker on the history chart says when hovered or tapped. */
export function markerWords(change: MistakeChange, day: Day): string {
  const when = dayLabel(change.day, day);
  return change.kind === "trial" ? `Trial began ${when}` : `Rule changed ${when}: ${change.what}`;
}

/**
 * The label over a day's marker on the history chart: "Rule changed 8 Nov" (a rule change wins a shared day), or
 * "Trial began 6 Nov". Null for a rule change that only opens the compared window, as its shaded band shows that.
 */
export function markerLabel(changes: MistakeChange[], mistake: Mistake, day: Day): string | null {
  const when = dayLabel(changes[0].day, day);
  const rule = changes.some((c) => c.kind === "rule");
  if (rule && changes[0].day === mistake.before?.from && changes[0].day !== mistake.rule?.day) return null;
  return rule ? `Rule changed ${when}` : `Trial began ${when}`;
}

/**
 * How few tasks a mistake's before and since rates rest on ("only 7 tasks before and 3 after the rule"), or null when
 * both sides have enough.
 */
export function fewTasksNote(mistake: Mistake): string | null {
  return fewTasks([
    { tasks: mistake.before?.tasks, label: "before" },
    { tasks: mistake.after?.tasks, label: "after the rule" },
  ]);
}

export const NO_RECENT_TASKS = "No tasks in the last 4 weeks";

export interface HistoryRow {
  day: Day;
  /** History outside the compared windows: context only. */
  earlier: number | null;
  /** The window the before rate (or, with no rule, the rate now) covers. */
  before: number | null;
  /** From the latest rule change. */
  after: number | null;
}

/**
 * The history chart's rows, split so grey means exactly the compared window: `earlier` up to the window's start,
 * `before` from it to the latest rule change, `after` from that change. Neighbouring parts share their boundary day,
 * so the line runs on unbroken while its colour switches exactly there.
 */
export function historyRows(mistake: Mistake): HistoryRow[] {
  const ruleDay = mistake.rule?.day;
  const from = mistake.rule ? mistake.before?.from : mistake.current?.from;
  const end = ruleDay ?? "9999-12-31";
  return mistake.series.map(({ day, rate }) => {
    const inWindow = from !== undefined && day >= from && day <= end;
    return {
      day,
      earlier: from === undefined ? (day <= end ? rate : null) : day <= from ? rate : null,
      before: inWindow ? rate : null,
      after: ruleDay !== undefined && day >= ruleDay ? rate : null,
    };
  });
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

/** `day`, or `first` when `day` is earlier; days are ISO dates, so they compare as text. */
const notBefore = (day: Day, first: Day) => (day.localeCompare(first) < 0 ? first : day);

/**
 * The compared windows shaded behind a history chart, within its series: grey from the before window's start (or,
 * with no rule, the rate now's) to the latest rule change or the last day, and blue from that change to the last day.
 */
export function historyBands(mistake: Mistake): { kind: "before" | "after"; from: Day; to: Day }[] {
  const first = mistake.series[0]?.day;
  const last = mistake.series.at(-1)?.day;
  if (!first || !last) return [];
  const ruleDay = mistake.rule?.day;
  const from = mistake.rule ? mistake.before?.from : mistake.current?.from;
  const bands: { kind: "before" | "after"; from: Day; to: Day }[] = [];
  const end = ruleDay ?? last;
  if (from !== undefined && end >= first) bands.push({ kind: "before", from: notBefore(from, first), to: end });
  if (ruleDay !== undefined) bands.push({ kind: "after", from: notBefore(ruleDay, first), to: last });
  return bands;
}

/** A mistake's change in the overview's scorecard: the bold words, or a short reason when there is no change. */
export function scoreWords(mistake: Mistake): ChangeWords {
  const words = changeWords(mistake.change, "plain", missingMistakeChange(mistake));
  if (words.hasRange) return words;
  const enough = Math.min(mistake.before?.tasks ?? 0, mistake.after?.tasks ?? 0) >= FEWEST_TASKS;
  return { ...words, lead: mistake.change === null && enough ? "Nothing to compare" : "Too few tasks" };
}
