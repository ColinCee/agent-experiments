import { format, parseISO } from "date-fns";
import type { Day } from "@/data/report";

/** A fraction as a whole percent: 0.314 → "31%". */
export function percent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

const count = new Intl.NumberFormat("en-US");

export function number(n: number): string {
  return count.format(n);
}

/** "1 task", "12 tasks". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${number(n)} ${n === 1 ? one : many}`;
}

/** "8 Nov", with the year only when it is not the report's year. */
export function dayLabel(day: Day, reportDay: Day): string {
  const date = parseISO(day);
  return format(date, day.slice(0, 4) === reportDay.slice(0, 4) ? "d MMM" : "d MMM yyyy");
}

/** A YYYY-MM month as "Oct", with the year only when it is not the report's year. */
export function monthLabel(month: string, reportDay: Day): string {
  return dayLabel(`${month}-01`, reportDay).replace(/^1 /, "");
}

/** "12 Nov, 22:39" in `timeZone`, the viewer's own when left out. */
export function timeLabel(iso: string, timeZone?: string): string {
  // Intl only for the time zone: its month names ("Sept") differ from date-fns's, used everywhere else.
  const parts = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const local = new Date(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
  return format(local, "d MMM, HH:mm");
}

/** Below this many tasks a rate is a small sample, and the page says so. */
export const FEW_TASKS = 10;

/**
 * A muted line for a pair of rates resting on few tasks: "only 3 tasks after the rule", or "only 6 tasks before and 3
 * after the rule" when both are few; null when neither side is small (a side with no tasks says so on its own).
 */
export function fewTasks(sides: { tasks: number | undefined; label: string }[]): string | null {
  const few = sides.filter((s): s is { tasks: number; label: string } => !!s.tasks && s.tasks < FEW_TASKS);
  if (few.length === 0) return null;
  const [first, ...rest] = few;
  return `only ${plural(first.tasks, "task")} ${first.label}${rest.map((s) => ` and ${s.tasks} ${s.label}`).join("")}`;
}
