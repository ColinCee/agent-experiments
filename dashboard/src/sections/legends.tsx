import type { ReactNode } from "react";
import { StripAxis } from "@/components/change-strip";
import { PairLegend, STRIP_GUTTER, TRACK_START } from "@/components/rate-pair";

/** A header that starts where every row's track starts, so it reads as the chart's key. */
function TrackHead({ children }: { children: ReactNode }) {
  return <div className={`${TRACK_START} text-sm text-muted-foreground`}>{children}</div>;
}

export function PairHeader({ from, to }: { from: string; to: string }) {
  return (
    <TrackHead>
      <PairLegend from={from} to={to} />
    </TrackHead>
  );
}

export function RateHeader({ title }: { title: string }) {
  return <TrackHead>{title}</TrackHead>;
}

export function StripHeader({ same }: { same: string }) {
  return (
    <div className={STRIP_GUTTER}>
      <StripAxis same={same} />
    </div>
  );
}

/** Sparklines have no shared scale, so their header is words only. */
export function SparkHeader({ title }: { title: string }) {
  return <TrackHead>{title}</TrackHead>;
}
