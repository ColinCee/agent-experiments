/** The top of a rate chart's axis: the smallest of 25%, 50% and 100% that holds every value, so low rates don't lie flat. */
export function rateCeiling(values: (number | null)[]): number {
  const most = Math.max(0, ...values.filter((v): v is number => v !== null));
  return [0.25, 0.5].find((top) => most <= top) ?? 1;
}

/** Ticks at 0 and each quarter of the ceiling. */
export function rateTicks(ceiling: number): number[] {
  return [0, 1, 2, 3, 4].map((i) => (ceiling * i) / 4);
}

export interface LabelSlot {
  /** 0 is the row next to the plot, 1 the row above it; null when there is no room, so only the marker shows. */
  row: 0 | 1 | null;
  anchor: "start" | "middle" | "end";
}

const GAP = 4;

/**
 * Places marker labels above a chart without overlapping or running past its edges: a label near an edge is anchored
 * inward, and when two would overlap the earlier one moves up a row, or loses its label if that row is taken too.
 */
export function layoutLabels(labels: { x: number; width: number }[], left: number, right: number): LabelSlot[] {
  const slots: LabelSlot[] = labels.map(() => ({ row: null, anchor: "middle" }));
  const taken: [number, number][][] = [[], []];
  const order = labels.map((_, i) => i).sort((a, b) => labels[b].x - labels[a].x);
  for (const i of order) {
    const { x, width } = labels[i];
    const anchor = x - width / 2 < left ? "start" : x + width / 2 > right ? "end" : "middle";
    const from = anchor === "start" ? x : anchor === "end" ? x - width : x - width / 2;
    const box: [number, number] = [from, from + width];
    const row = ([0, 1] as const).find((r) => taken[r].every(([a, b]) => box[1] + GAP <= a || box[0] >= b + GAP));
    slots[i] = { row: row ?? null, anchor };
    if (row !== undefined) taken[row].push(box);
  }
  return slots;
}
