import { StripAxis } from "@/components/change-strip";
import { LABEL_GUTTER, PairLegend, STRIP_GUTTER } from "@/components/rate-pair";

/** The 0% and 100% ends of the chart column, lined up with every row's track below. */
function Scale() {
  return (
    <div className={LABEL_GUTTER}>
      <div data-scale className="relative h-4 text-xs leading-4 text-muted-foreground">
        <span className="absolute left-0 -translate-x-1/2">0%</span>
        <span className="absolute right-0 translate-x-1/2">100%</span>
      </div>
    </div>
  );
}

/** The legend of a column of before → since pairs, said once: which side is grey, which blue, on a 0–100% scale. */
export function PairHeader({ from, to }: { from: string; to: string }) {
  return (
    <div className="space-y-0.5">
      <PairLegend from={from} to={to} />
      <Scale />
    </div>
  );
}

/** The legend of a column of single rates. */
export function RateHeader({ title }: { title: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-sm">{title}</div>
      <Scale />
    </div>
  );
}

/** The legend of a column of change strips: what changes, and what the centre is compared against. */
export function StripHeader({ title, same }: { title: string; same: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-sm">{title}</div>
      <div className={STRIP_GUTTER}>
        <StripAxis same={same} />
      </div>
    </div>
  );
}

/** The legend of a column of sparklines, which have no shared scale. */
export function SparkHeader({ title }: { title: string }) {
  return <div className="text-sm">{title}</div>;
}
