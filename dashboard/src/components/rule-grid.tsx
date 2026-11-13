import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The column template shared by every table of mistakes on a page, so their rate tracks line up across tables:
 * name · first rate · second rate · track · change (or tasks). Phones stack each row instead.
 */
export const RULE_COLUMNS =
  "md:grid md:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_minmax(0,0.6fr)_minmax(0,1.9fr)] md:items-center md:gap-x-5";

/** The header row: on phones it is hidden and each row labels its own numbers. */
export function GridHeader({ children }: { children: ReactNode }) {
  return (
    <div className={cn(RULE_COLUMNS, "hidden border-b pb-2 text-sm text-muted-foreground md:grid")}>{children}</div>
  );
}

/** One row; a link when `href` is given, so the whole row can be clicked. */
export function GridRow({ href, children }: { href?: string; children: ReactNode }) {
  const className = cn(
    RULE_COLUMNS,
    "block space-y-3 rounded-lg border p-4 md:space-y-0 md:rounded-none md:border-0 md:border-b md:px-0 md:py-3",
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
