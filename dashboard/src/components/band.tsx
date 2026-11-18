import { ChevronRight } from "lucide-react";
import { isClipped, stripPosition } from "@/lib/change";
import { signedPercent } from "@/lib/format";
import type { Drawn } from "@/lib/rows";
import type { Status } from "@/lib/status";
import { cn } from "@/lib/utils";
import { STATUS_TONE } from "./status-icon";

const at = (change: number) => `${stripPosition(change) * 100}%`;

/** A rule must stay able to cut mistakes by this much (docs/architecture.md#looks). */
const USEFUL = -0.3;

/** A change and its 90% range on the page's one scale; `large` also marks the cut a rule must reach. */
export function Band({ change, status, large = false }: { change: Drawn; status: Status; large?: boolean }) {
  const left = stripPosition(change.low);
  const width = stripPosition(change.high) - left;
  return (
    <div data-track="change" className={cn("relative", large ? "h-6" : "h-4", STATUS_TONE[status])}>
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
      <span data-zero className="absolute top-0 h-full w-px -translate-x-1/2 bg-ring" style={{ left: at(0) }} />
      {large && (
        <span
          data-useful
          className="absolute top-0 h-full border-ring border-l border-dashed"
          style={{ left: at(USEFUL) }}
        />
      )}
      <span
        data-range
        className={cn(
          "absolute top-1/2 -translate-y-1/2 rounded-full bg-current opacity-30",
          large ? "h-2.5" : "h-1.5",
        )}
        style={{ left: `${left * 100}%`, width: `${width * 100}%` }}
      />
      <span
        data-value={change.value}
        className={cn(
          "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current",
          large ? "size-2" : "size-1.5",
        )}
        style={{ left: at(change.value) }}
      />
      {isClipped(change) && (
        <ChevronRight data-clipped aria-hidden className="absolute top-1/2 -right-3.5 size-3 -translate-y-1/2" />
      )}
    </div>
  );
}

const TICKS = [-1, -0.5, 0, 0.5, 1];

/** The band column's header is the scale itself, each number over its place on the bands below. */
export function Scale() {
  return (
    <div data-axis title="Change in mistakes with the rule" className="relative h-4 font-mono text-xs">
      {TICKS.map((tick, i) => (
        <span
          key={tick}
          data-value={tick}
          className={cn(
            "absolute top-0",
            i === 0 ? "" : i === TICKS.length - 1 ? "-translate-x-full" : "-translate-x-1/2",
          )}
          style={{ left: at(tick) }}
        >
          {tick === 0 ? "0" : signedPercent(tick)}
        </span>
      ))}
    </div>
  );
}
