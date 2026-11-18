/** One day of a rate chart: each side's rate, null with no chances. */
export type TrendRow = { label: string; with: number | null; without: number | null };

/** Each axis top a rate chart may use, with its tick step: round numbers only. */
const CEILINGS = [
  { top: 0.2, step: 0.05 },
  { top: 0.5, step: 0.1 },
  { top: 1, step: 0.25 },
];

/** The top of a rate chart's axis: the smallest of 20%, 50% and 100% that holds every value, so low rates don't lie flat. */
export function rateCeiling(values: (number | null)[]): number {
  const most = Math.max(0, ...values.filter((v): v is number => v !== null));
  return (CEILINGS.find((c) => most <= c.top) ?? CEILINGS[2]).top;
}

/** Ticks from 0 to the ceiling: every 5% up to 20%, every 10% up to 50%, every 25% up to 100%. */
export function rateTicks(ceiling: number): number[] {
  const { top, step } = CEILINGS.find((c) => c.top === ceiling) ?? CEILINGS[2];
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => Math.round(i * step * 100) / 100);
}
