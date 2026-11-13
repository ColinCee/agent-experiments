import type { Day, Sizes } from "@/data/report";
import { dayLabel, number } from "./format";

type Series = Sizes["series"][number];

/** "+1,035 since 14 Oct": words added since the first point, never a fraction (a file set may start empty). */
export function growthWords(series: Series, day: Day): string | null {
  const first = series.points[0];
  const last = series.points.at(-1);
  if (!first || !last) return null;
  const added = last.words - first.words;
  const since = dayLabel(first.day, day);
  if (added === 0) return `No change since ${since}`;
  return `${added > 0 ? "+" : "−"}${number(Math.abs(added))} since ${since}`;
}

/** Words added since the first point, for a size's row: "+1,035 words", "−200 words", "No change". */
export function wordsAdded(series: Series): string {
  const added = (series.points.at(-1)?.words ?? 0) - (series.points[0]?.words ?? 0);
  if (added === 0) return "No change";
  return `${added > 0 ? "+" : "−"}${number(Math.abs(added))} words`;
}

/** The files of one set among the largest: skills live under a skills folder, rules are the rest. */
export function filesOf(label: Series["label"], largest: Sizes["largest"]): Sizes["largest"] {
  const skill = (file: string) => /(^|\/)skills\//.test(file);
  return largest.filter((f) => (label === "Skills") === skill(f.file));
}

/** A sparkline's points in a `width` × `height` box: time across, words up from 0 to the most words. */
export function sparkPoints(points: Series["points"], width: number, height: number): string {
  const most = Math.max(1, ...points.map((p) => p.words));
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  return points.map((p, i) => `${round(i * step)},${round(height - (p.words / most) * height)}`).join(" ");
}

const round = (x: number) => Math.round(x * 10) / 10;
