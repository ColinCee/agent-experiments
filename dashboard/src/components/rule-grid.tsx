import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The scorecard's column template, shared by the overview's tables of mistakes so their charts line up: name · rates as
 * text · the one chart (the flexible column) · result words. On phones a row is a card: the name, then the rates left
 * and the result right, then the chart full width. Cells place themselves with the `CELL` classes.
 */
export const RULE_COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 md:grid-cols-[minmax(0,10rem)_7rem_minmax(9rem,1fr)_7rem] md:items-center md:gap-x-4 md:px-3";

export const CELL = {
  name: "col-span-2 row-start-1 md:col-span-1",
  rates: "col-start-1 row-start-2 md:col-start-2 md:row-start-1 md:justify-self-end",
  chart: "col-span-2 row-start-3 md:col-span-1 md:col-start-3 md:row-start-1",
  result: "col-start-2 row-start-2 justify-self-end md:col-start-4 md:row-start-1 md:justify-self-start",
};

/** The header row: on phones it is hidden and each row labels its own numbers. */
export function GridHeader({ children }: { children: ReactNode }) {
  return (
    <div className={cn(RULE_COLUMNS, "hidden items-end border-b pb-2 text-sm text-muted-foreground md:grid")}>
      {children}
    </div>
  );
}

/**
 * One row, picked by click, Enter or Space; Up and Down move the pick (`onMove`). The picked row is tinted with a
 * neutral bar at its left: blue, green and red already mean with the rule, fewer mistakes and needs attention.
 */
export function GridRow({
  id,
  selected,
  onSelect,
  onMove,
  children,
}: {
  id: string;
  selected: boolean;
  onSelect: () => void;
  onMove: (step: 1 | -1) => void;
  children: ReactNode;
}) {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") onSelect();
    else if (e.key === "ArrowDown") onMove(1);
    else if (e.key === "ArrowUp") onMove(-1);
    else return;
    e.preventDefault();
  };
  return (
    <div
      role="option"
      tabIndex={0}
      aria-selected={selected}
      data-row={id}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={cn(
        RULE_COLUMNS,
        "cursor-pointer rounded-lg border p-4 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring md:rounded-none md:border-0 md:border-b md:py-2.5",
        selected && "bg-muted shadow-[inset_2px_0_0_var(--foreground)] hover:bg-muted",
      )}
    >
      {children}
    </div>
  );
}
