import type { FocusEvent, MouseEvent, PointerEvent } from "react";
import type { Day } from "@/data/report";
import { dayLabel, percent } from "@/lib/format";
import { rowHref } from "@/lib/hash";
import type { Row } from "@/lib/rows";
import { REAL_DAYS, STATUS_WORDS } from "@/lib/status";
import { cn } from "@/lib/utils";
import { STATUS_TONE, StatusIcon } from "./status-icon";

// One grid for the header and every row. On a phone the verdict takes a second line under the change.
const GRID =
  "grid grid-cols-[minmax(0,1fr)_3rem_5rem] items-baseline gap-x-3 px-3.5 sm:grid-cols-[minmax(0,1fr)_3.5rem_5rem_8.5rem] sm:gap-x-4";

export interface RowEvents {
  onPreview: (id: string) => void;
  onFocusRow: (id: string) => void;
  onToggle: (id: string) => void;
}

/** A row's pointer, focus and click handling. */
export function rowHandlers(id: string, pinned: string | null, events: RowEvents, onFocusOut: () => void) {
  return {
    onPointerEnter: (event: PointerEvent<HTMLElement>) => event.pointerType === "mouse" && events.onPreview(id),
    onFocus: (event: FocusEvent<HTMLElement>) => event.currentTarget.matches(":focus-visible") && events.onFocusRow(id),
    onBlur: (event: FocusEvent<HTMLElement>) =>
      !event.currentTarget.closest("[data-table]")?.contains(event.relatedTarget) && onFocusOut(),
    onClick: (event: MouseEvent<HTMLElement>) => {
      // A second click on the kept row lets go of it; any other click follows the link.
      if (pinned !== id || event.metaKey || event.ctrlKey) return;
      event.preventDefault();
      events.onToggle(id);
    },
  };
}

/** A row's verdict, or the day it is due while it waits. */
function verdictWords(row: Row, day: Day): string {
  return row.trial.verdict ? STATUS_WORDS[row.status] : `Day ${REAL_DAYS} on ${dayLabel(row.trial.due, day)}`;
}

/** Since the change: its rate so far, or the day it starts. */
function sinceWords(row: Row, day: Day): string {
  const { after, started } = row.trial;
  return after ? percent(after.rate) : `from ${dayLabel(started, day)}`;
}

/** This week's rule changes, one row each: the mistake rate before and since, and the verdict. */
export function RuleTable({
  rows,
  day,
  pinned,
  shown,
  events,
  onLeave,
  onFocusOut,
}: {
  rows: Row[];
  day: Day;
  pinned: string | null;
  shown: string | null;
  events: RowEvents;
  onLeave: () => void;
  onFocusOut: () => void;
}) {
  if (rows.length === 0) {
    return <p className="rounded-lg border px-3.5 py-6 text-muted-foreground">No rule changes this week.</p>;
  }
  return (
    <div data-table className="overflow-clip rounded-lg border" onPointerLeave={onLeave}>
      <div className={cn(GRID, "items-center border-b py-2 text-muted-foreground text-xs")}>
        <span>Change</span>
        <span className="text-right">Before</span>
        <span className="text-right">Since</span>
        <span className="max-sm:hidden">Verdict</span>
      </div>
      {rows.map((row) => (
        <a
          key={row.id}
          href={rowHref(row.id)}
          data-row={row.id}
          data-status={row.status}
          aria-label={`${row.name}: before ${row.trial.before ? percent(row.trial.before.rate) : "none"}, since ${sinceWords(row, day)}, ${verdictWords(row, day)}`}
          aria-current={pinned === row.id ? "true" : undefined}
          className={cn(
            GRID,
            "relative gap-y-1 border-b py-2.5 outline-none transition-colors last:border-b-0",
            "hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
            shown === row.id && "bg-muted",
            pinned === row.id && "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-foreground",
          )}
          {...rowHandlers(row.id, pinned, events, onFocusOut)}
        >
          <span className="grid gap-0.5">
            <span data-name className="font-medium">
              {row.name}
            </span>
            {row.trial.what && <span className="text-muted-foreground text-xs">{row.trial.name}</span>}
          </span>
          <span data-before className="text-right font-mono text-xs">
            {row.trial.before ? percent(row.trial.before.rate) : "–"}
          </span>
          <span
            data-since
            className={cn(
              "whitespace-nowrap text-right text-xs",
              row.trial.after ? "font-mono" : "text-muted-foreground",
            )}
          >
            {sinceWords(row, day)}
          </span>
          <span
            data-verdict
            className={cn(
              "flex items-center gap-1.5 text-xs max-sm:col-span-3 max-sm:row-start-2",
              STATUS_TONE[row.status],
            )}
          >
            <StatusIcon status={row.status} decorative />
            {verdictWords(row, day)}
          </span>
        </a>
      ))}
    </div>
  );
}
