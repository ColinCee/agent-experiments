import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The scorecard's column template, shared by the overview's tables of mistakes so their charts line up: name · rates as
 * text · the one chart (the flexible column) · result words. On phones a row is a card: the name, then the rates left
 * and the result right, then the chart full width. Cells place themselves with the `CELL` classes.
 */
export const RULE_COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 md:grid-cols-[minmax(0,13rem)_8.5rem_minmax(0,1fr)_7.5rem] md:items-center md:gap-x-5";

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

/** One row; a link when `href` is given, so the whole row can be clicked. */
export function GridRow({ href, children }: { href?: string; children: ReactNode }) {
  const className = cn(
    RULE_COLUMNS,
    "rounded-lg border p-4 md:rounded-none md:border-0 md:border-b md:px-0 md:py-2.5",
    href && "transition-colors hover:bg-muted/50",
  );
  return href ? (
    <a href={href} className={className}>
      {children}
    </a>
  ) : (
    <div className={className}>{children}</div>
  );
}
