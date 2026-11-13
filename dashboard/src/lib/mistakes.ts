import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import type { Day, Mistake, MistakeChange } from "@/data/report";
import { changeTone, missingChange, type Tone } from "./change";
import { dayLabel, fewTasks, percent, plural } from "./format";

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

/** The days a before or since window covers: "2 Nov to 4 Nov", or "on 4 Nov" for a single day. */
function span(from: Day, to: Day, day: Day): string {
  return from === to ? `on ${dayLabel(from, day)}` : `${dayLabel(from, day)} to ${dayLabel(to, day)}`;
}

/** The last day of the before window: the day before the latest rule change. */
const beforeEnds = (rule: { day: Day }) => format(subDays(parseISO(rule.day), 1), "yyyy-MM-dd");

/** The windows the before and since rates cover: "14 tasks 2 Nov to 4 Nov · 82 since 5 Nov". */
export function ruleTasks(mistake: Mistake, day: Day): string {
  if (!mistake.rule) return "";
  const before = mistake.before
    ? `${plural(mistake.before.tasks, "task")} ${span(mistake.before.from, beforeEnds(mistake.rule), day)}`
    : "No tasks before the rule";
  return `${before} · ${mistake.after?.tasks ?? 0} since ${dayLabel(mistake.rule.day, day)}`;
}

/** Shorter than this, a before window is named on the overview, since "before" alone suggests far longer. */
const SHORT_WINDOW = 7;

/** The longest hint line that still fits its slot under a mistake's name on the overview. */
const HINT_ROOM = 48;

/**
 * The one muted line under a mistake's name on the overview: how few tasks the rates rest on, and how short the
 * before window is ("before = 2 Nov to 4 Nov") when that still fits the line; null when neither applies.
 */
export function overviewHint(mistake: Mistake, day: Day): string | null {
  const few = fewTasks([
    { tasks: mistake.before?.tasks, label: "before" },
    { tasks: mistake.after?.tasks, label: "since the rule" },
  ]);
  const { before, rule } = mistake;
  const short =
    before && rule && differenceInCalendarDays(parseISO(rule.day), parseISO(before.from)) < SHORT_WINDOW
      ? `before = ${span(before.from, beforeEnds(rule), day).replace(/^on /, "")}`
      : null;
  const both = few && short ? `${few} · ${short}` : null;
  return both && both.length <= HINT_ROOM ? both : (few ?? short);
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
