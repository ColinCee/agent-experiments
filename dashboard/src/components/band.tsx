import { ChevronRight } from "lucide-react";
import { isClipped, stripPosition } from "@/lib/change";
import type { Drawn } from "@/lib/rows";
import type { Status } from "@/lib/status";
import { cn } from "@/lib/utils";
import { STATUS_TONE } from "./status-icon";

const at = (change: number) => `${stripPosition(change) * 100}%`;

/** A change and its 90% range on the page's one scale. */
export function Band({ change, status }: { change: Drawn; status: Status }) {
  const left = stripPosition(change.low);
  const width = stripPosition(change.high) - left;
  return (
    <div data-track="change" className={cn("relative", "h-6", STATUS_TONE[status])}>
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
      <span data-zero className="absolute top-0 h-full w-px -translate-x-1/2 bg-ring" style={{ left: at(0) }} />
      <span
        data-range
        className={cn("absolute top-1/2 -translate-y-1/2 rounded-full bg-current opacity-30", "h-2.5")}
        style={{ left: `${left * 100}%`, width: `${width * 100}%` }}
      />
      <span
        data-value={change.value}
        className={cn("absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current", "size-2")}
        style={{ left: at(change.value) }}
      />
      {isClipped(change) && (
        <ChevronRight data-clipped aria-hidden className="absolute top-1/2 -right-3.5 size-3 -translate-y-1/2" />
      )}
    </div>
  );
}
