import type { ReactNode } from "react";
import { LABEL_GUTTER } from "@/components/rate-pair";
import { CELL, GridHeader, GridRow } from "@/components/rule-grid";
import { Empty, Section } from "@/components/section";
import type { BadgeTone } from "@/lib/change";
import type { Row } from "@/lib/rows";
import { cn } from "@/lib/utils";

/** How a section's rows take part in the page's one pick. */
export interface Picking {
  selected: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, step: 1 | -1) => void;
}

/** A row's name: one line, cut short only as a last resort (the panel shows it whole); wraps on a phone card. */
function Name({ name }: { name: string }) {
  return (
    <span data-name title={name} className={cn(CELL.name, "min-w-0 text-sm md:truncate")}>
      {name}
    </span>
  );
}

const RESULT: Record<BadgeTone, string> = {
  good: "font-semibold text-good",
  bad: "font-semibold text-bad",
  unclear: "font-semibold text-foreground",
  waiting: "text-[13px] text-muted-foreground",
};

/** A row's result: bold, and green or red only when sure; a reason or a state reads muted. */
export function Result({ tone, small = false, children }: { tone: BadgeTone; small?: boolean; children: ReactNode }) {
  return (
    <span className={cn(CELL.result, "leading-5 whitespace-nowrap", RESULT[tone], small && "text-[13px]")}>
      {children}
    </span>
  );
}

/** A short reason standing in the chart cell where there is nothing to draw yet, at the tracks' left edge. */
export function Reason({ children }: { children: ReactNode }) {
  return (
    <span className={cn(LABEL_GUTTER, "block truncate text-[13px] leading-5 text-muted-foreground")}>{children}</span>
  );
}

/**
 * One section of rows on the page's shared grid: a header row whose middle cell is the legend of the section's charts
 * (shown once above the first card on a phone), then one pickable row per thing: name · chart · result.
 */
export function RowsSection({
  id,
  title,
  note,
  heads,
  legend,
  rows,
  empty,
  picking,
  cells,
}: {
  id: string;
  title: string;
  note?: string;
  heads: { name: string; result: string };
  legend: ReactNode;
  rows: Row[];
  empty: string;
  picking: Picking;
  cells: (row: Row) => { chart: ReactNode; result: ReactNode };
}) {
  return (
    <Section id={id} title={title} note={rows.length > 0 ? note : undefined}>
      {rows.length === 0 ? (
        <Empty>{empty}</Empty>
      ) : (
        <div data-block data-table={id} role="listbox" aria-label={title} className="space-y-3 md:space-y-0">
          <GridHeader>
            <span>{heads.name}</span>
            {legend}
            <span>{heads.result}</span>
          </GridHeader>
          {/* Inset like a card's chart (its padding and border), so the legend lines up with every card's track. */}
          <div className="border-x border-transparent px-4 md:hidden">{legend}</div>
          {rows.map((row) => {
            const { chart, result } = cells(row);
            return (
              <GridRow
                key={row.id}
                id={row.id}
                selected={picking.selected === row.id}
                onSelect={() => picking.onSelect(row.id)}
                onMove={(step) => picking.onMove(row.id, step)}
              >
                <Name name={row.name} />
                <div className={CELL.chart}>{chart}</div>
                {result}
              </GridRow>
            );
          })}
        </div>
      )}
    </Section>
  );
}
