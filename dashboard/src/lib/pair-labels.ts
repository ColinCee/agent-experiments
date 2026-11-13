import { percent } from "./format";

export type LabelSide = "without" | "with";

/** One label on a rate pair's track: its parts in their sides' colours, and its left edge in px from the track's start. */
export interface PairLabel {
  parts: { text: string; side: LabelSide | null }[];
  left: number;
  width: number;
  /** Drawn just under the line instead of beside the dots: the last resort when no side has room. */
  below?: boolean;
}

/** Room between a dot's centre and its label: the dot's radius and a small gap. */
const ROOM = 5 + 4;

/**
 * Where the numbers of a before → since pair go on its track, so none overlaps a dot, the line between the dots or
 * the other number: the left-most dot's number to its left and the right-most's to its right. When the dots sit
 * closer than a number's width, or a number has no room on its outer side, both share one label ("31% → 6%") beside
 * the pair, to the right if it fits, else to the left; when neither side has room (a pair spanning most of the
 * track), it goes just under the line, between the dots if it fits there. `measure` gives a text's drawn width in px.
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
  const rightOf = (x: number, w: number) => (x + ROOM + w <= width ? x + ROOM : null);
  const leftOf = (x: number, w: number) => (x - ROOM - w >= 0 ? x - ROOM - w : null);
  const single = (text: string, side: LabelSide, x: number): PairLabel[] => {
    const w = measure(text);
    return [{ parts: [{ text, side }], left: rightOf(x, w) ?? leftOf(x, w) ?? 0, width: w }];
  };
  if (dots.length === 0) return [];
  if (dots.length === 1) return single(dots[0].text, dots[0].side, dots[0].x);
  const [lo, hi] = dots[0].x <= dots[1].x ? [dots[0], dots[1]] : [dots[1], dots[0]];
  const [wLo, wHi] = [measure(lo.text), measure(hi.text)];
  if (hi.x - lo.x >= Math.min(wLo, wHi)) {
    const [left, right] = [leftOf(lo.x, wLo), rightOf(hi.x, wHi)];
    if (left !== null && right !== null) {
      return [
        { parts: [{ text: lo.text, side: lo.side }], left, width: wLo },
        { parts: [{ text: hi.text, side: hi.side }], left: right, width: wHi },
      ];
    }
  }
  const [b, a] = [dots[0], dots[1]];
  const parts = [
    { text: b.text, side: b.side },
    { text: " → ", side: null },
    { text: a.text, side: a.side },
  ];
  const w = measure(parts.map((p) => p.text).join(""));
  const beside = rightOf(hi.x, w) ?? leftOf(lo.x, w);
  if (beside !== null) return [{ parts, left: beside, width: w }];
  const middle = (lo.x + hi.x) / 2 - w / 2;
  const left = Math.min(Math.max(middle, lo.x + ROOM, 0), hi.x - ROOM - w, width - w);
  return [{ parts, left: Math.max(0, left), width: w, below: true }];
}
