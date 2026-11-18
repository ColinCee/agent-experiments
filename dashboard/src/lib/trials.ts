import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Day, Trial } from "@/data/report";

const days = (from: Day, to: Day) => differenceInCalendarDays(parseISO(to), parseISO(from));

/** Stands for a trial that needs more tasks than this per half, since the report gives no number above it. */
export const MOST_NEEDED = 320;

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
  // The last look's day falls one past the trial's length, so the chart stops at the day before it.
  return Array.from({ length: days(trial.started, trial.ends) }, (_, i) => {
    const point = byDay.get(i + 1);
    return { label: `Day ${i + 1}`, with: point?.with ?? null, without: point?.without ?? null };
  });
}

/** The trend chart's label for each day the trial was checked. */
export function lookLabels(trial: Trial): string[] {
  const length = days(trial.started, trial.ends);
  return trial.looks.map((look) => `Day ${Math.min(length, days(trial.started, look.day) + 1)}`);
}
