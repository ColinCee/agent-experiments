import { percent } from "./format";

export type LabelSide = "without" | "with";

/** One number on a rate pair's track, in its side's colour, with its left edge in px from the track's start. */
export interface PairLabel {
  text: string;
  side: LabelSide;
  left: number;
  width: number;
}

/** Room between a dot's centre and its number: the dot's radius and a small gap. */
export const LABEL_ROOM = 5 + 4;

/**
 * Where the numbers of a before → since pair go: always the left-most dot's number just left of it and the right-most
 * dot's just right of it, so they never cross the dots or the arrow between them. Equal rates count before as the
 * left one. The track keeps a gutter at each end wide enough for a number, so this always fits. `measure` gives a
 * text's drawn width in px.
 */
export function layoutPair(
  before: number | null,
  after: number | null,
  width: number,
  measure: (text: string) => number,
): PairLabel[] {
  const dots = (
    [
      { side: "without", rate: before },
      { side: "with", rate: after },
    ] as const
  ).flatMap((d) => (d.rate === null ? [] : [{ side: d.side, x: d.rate * width, text: percent(d.rate) }]));
  if (dots.length === 0) return [];
  const right = (d: (typeof dots)[number]) => ({
    text: d.text,
    side: d.side,
    left: d.x + LABEL_ROOM,
    width: measure(d.text),
  });
  if (dots.length === 1) return [right(dots[0])];
  const [lo, hi] = dots[1].x < dots[0].x ? [dots[1], dots[0]] : [dots[0], dots[1]];
  const w = measure(lo.text);
  return [{ text: lo.text, side: lo.side, left: lo.x - LABEL_ROOM - w, width: w }, right(hi)];
}
