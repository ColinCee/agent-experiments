import type { Range } from "@/data/report";

/** Fewer tasks than this in the smaller group and the range means little. */
export const FEWEST_TASKS = 5;

/** True when the change or its range goes past +100%, the band's right edge, so the band shows a mark there. */
export function isClipped(change: Range | null): boolean {
  return Math.max(change?.value ?? 0, change?.high ?? 0) > 1;
}

/** Where a change sits on the scale from -100% (left, 0) to +100% (right, 1); beyond +100% is held at the edge. */
export function stripPosition(change: number): number {
  return (Math.min(1, Math.max(-1, change)) + 1) / 2;
}
