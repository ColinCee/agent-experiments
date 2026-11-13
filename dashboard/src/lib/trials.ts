import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Day, Replay, Trial, Verdict } from "@/data/report";
import { type BadgeTone, changeTone } from "./change";
import { dayLabel, number } from "./format";

const days = (from: Day, to: Day) => differenceInCalendarDays(parseISO(to), parseISO(from));

/** Shown when a trial needs more tasks than this per half, since the report gives no number above it. */
export const MOST_NEEDED = 320;

/** The trial's day number on `day` (the start is day 1) and its length; the last look's day counts as the last. */
export function trialDay(trial: Trial, day: Day): { n: number; of: number } {
  const of = days(trial.started, trial.ends);
  return { n: Math.min(of, Math.max(1, days(trial.started, day) + 1)), of };
}

/** The day a finished trial reached its verdict: its last look's. */
export function finishedOn(trial: Trial): Day {
  return trial.looks.at(-1)?.day ?? trial.ends;
}

/** When the trial is: "Starts 13 Nov", "Day 4 of 7" (with "· ends 16 Nov" in full), "Finished 9 Nov". */
export function trialWhen(trial: Trial, day: Day, full: boolean): string {
  if (trial.state === "scheduled") return `Starts ${dayLabel(trial.started, day)}`;
  if (trial.state === "finished") return `Finished ${dayLabel(finishedOn(trial), day)}`;
  const { n, of } = trialDay(trial, day);
  return full ? `Day ${n} of ${of} · ends ${dayLabel(trial.ends, day)}` : `Day ${n} of ${of}`;
}

export function verdictWords(verdict: Verdict | Replay["verdict"] | null): string {
  switch (verdict) {
    case "works":
      return "Works";
    // "effect" is not a word the page uses.
    case "no useful effect":
      return "No useful change";
    case "can't tell":
      return "Can't tell";
    case "replay can't test this":
      return "Replay can't test this";
    default:
      return "Too early";
  }
}

/** Both halves have tasks, so there is a result so far to show. */
export function hasResult(trial: Trial): boolean {
  return trial.tasks_with > 0 && trial.tasks_without > 0;
}

/** Tasks per half the task bars' full width stands for. */
export function taskScale(trial: Trial): number {
  return Math.max(trial.needed ?? MOST_NEEDED, trial.tasks_with, trial.tasks_without, 1);
}

export function neededWords(trial: Trial): string {
  return trial.needed === null ? `over ${MOST_NEEDED} needed` : `about ${number(trial.needed)} needed`;
}

/** The one line under a trial's task bars, or null when there is nothing to warn about. */
export function tasksNote(trial: Trial): string | null {
  const short = trial.state !== "finished" && trial.per_week < (trial.needed ?? Number.POSITIVE_INFINITY);
  const warning = `A week usually brings about ${number(trial.per_week)} per half, so this trial may end unclear.`;
  if (trial.state === "scheduled") return short ? `No tasks yet. ${warning}` : "No tasks yet.";
  return short ? warning : null;
}

const ORDER: Record<Trial["state"], number> = { running: 0, scheduled: 1, finished: 2 };

/** Running first, then scheduled (soonest first), then finished (latest first). */
export function sortTrials(trials: Trial[]): Trial[] {
  return trials.toSorted(
    (a, b) =>
      ORDER[a.state] - ORDER[b.state] ||
      (a.state === "finished" ? b.started.localeCompare(a.started) : a.started.localeCompare(b.started)),
  );
}

/** The trend chart's rows by day of the trial ("Day 1" …), padded with empty days up to the trial's length. */
export function trendRows(trial: Trial): { label: string; with: number | null; without: number | null }[] {
  const byDay = new Map(trial.trend.map((t) => [days(trial.started, t.day) + 1, t]));
  // The last look's day falls one past the trial's length; like the header's "Day 7 of 7", the chart stops at 7.
  return Array.from({ length: days(trial.started, trial.ends) }, (_, i) => {
    const point = byDay.get(i + 1);
    return { label: `Day ${i + 1}`, with: point?.with ?? null, without: point?.without ?? null };
  });
}

const STATE: Record<Trial["state"], string> = { scheduled: "Scheduled", running: "Running", finished: "Finished" };

/** A finished trial's badge says its verdict; one still going says where it is. */
export function trialBadge(trial: Trial): { tone: BadgeTone; text: string } {
  if (trial.state !== "finished") return { tone: "waiting", text: STATE[trial.state] };
  const tone = trial.verdict === "works" ? "good" : changeTone(trial.change) === "bad" ? "bad" : "unclear";
  return { tone, text: verdictWords(trial.verdict) };
}

/** A trial in one line for the overview: "Day 4 of 7 · 12 with · 11 without", or only when it starts. */
export function trialSummary(trial: Trial, day: Day): string {
  const when = trialWhen(trial, day, false);
  if (trial.state === "scheduled") return when;
  return `${when} · ${number(trial.tasks_with)} with · ${number(trial.tasks_without)} without`;
}
