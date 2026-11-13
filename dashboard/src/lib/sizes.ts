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
