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
