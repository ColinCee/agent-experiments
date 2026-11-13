/** The 0–100% axis of every rate chart: four gridlines above the base. */
export const PERCENT_TICKS = [0, 0.25, 0.5, 0.75, 1];

/**
 * An invisible point on a line carrying its day and value, so the browser tests can find where each point is drawn.
 * Recharts calls it for every row, with no `value` where the line has a gap.
 */
export function PointMark({
  cx,
  cy,
  value,
  payload,
  series,
}: {
  cx?: number;
  cy?: number;
  value?: unknown;
  payload?: { day?: string | number };
  series: string;
}) {
  if (typeof value !== "number" || cx === undefined || cy === undefined) return null;
  return <circle cx={cx} cy={cy} r={0} data-day={payload?.day} data-rate={value} data-series={series} />;
}
