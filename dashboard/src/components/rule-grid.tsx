import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The column template shared by every table of mistakes on a page, so their tracks line up across tables:
 * name · first rate · second rate · rate track · change strip · change words. The two tracks get equal widths so a row
 * reads as two matched instruments. Phones stack each row instead.
 */
export const RULE_COLUMNS =
  "md:grid md:grid-cols-[minmax(0,0.8fr)_4.5rem_4.5rem_minmax(0,1fr)_minmax(0,1fr)_10rem] md:items-center md:gap-x-5";

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
