import type { Sizes } from "@/data/report";
import { number } from "@/lib/format";
import { sparkPoints } from "@/lib/sizes";
import { LABEL_GUTTER } from "./rate-pair";

const WIDTH = 100;
const HEIGHT = 20;

/**
 * Words over time in one line, on its own scale from 0: no shared axis with the rate tracks, but the same inset, so it
 * sits in their column. The first day's words are written in the left gutter and the latest in the right one.
 */
export function Sparkline({ points }: { points: Sizes["series"][number]["points"] }) {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  return (
    <div className={LABEL_GUTTER}>
      <div data-spark className="relative h-5">
        <span className="absolute top-1/2 right-full mr-1.5 -translate-y-1/2 text-[13px] whitespace-nowrap text-muted-foreground">
          {number(first.words)}
        </span>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden
          className="h-full w-full overflow-visible"
        >
          <polyline
            points={sparkPoints(points, WIDTH, HEIGHT)}
            fill="none"
            vectorEffect="non-scaling-stroke"
            className="stroke-foreground/70"
            strokeWidth={1.5}
          />
        </svg>
        <span className="absolute top-1/2 left-full ml-1.5 -translate-y-1/2 text-[13px] font-medium whitespace-nowrap">
          {number(last.words)}
        </span>
      </div>
    </div>
  );
}
