import { ArrowUp, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { number, percent, plural } from "@/lib/format";
import { rowHref } from "@/lib/hash";
import { type ForceRow, GROUPS, needsHim } from "@/lib/in-force";
import { cn } from "@/lib/utils";
import { type RowEvents, rowHandlers } from "./rule-table";

const GRID =
  "grid grid-cols-[minmax(0,1fr)_5.5rem_4rem] items-baseline gap-x-3 px-3.5 sm:grid-cols-[minmax(0,1fr)_7rem_5rem] sm:gap-x-4";

/** Its mistake rate over 28 days, the highest when several mistakes count it. */
export function mistakeWords(row: ForceRow): string {
  if (!row.mistakes.length) return "Not measured";
  const rate = row.worst?.recent ? percent(row.worst.recent.rate) : "No chances";
  return row.high ? `${rate}, above usual today` : rate;
}

export function usedWords(row: ForceRow): string {
  if (row.trim) return "Unused";
  return row.item.used === null ? "–" : number(row.item.used);
}

function Mistakes({ row }: { row: ForceRow }) {
  if (!row.mistakes.length) return <span className="text-muted-foreground">Not measured</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono", row.high && "text-bad")}>
      {row.high && <ArrowUp aria-hidden className="size-3.5" />}
      {row.worst?.recent ? percent(row.worst.recent.rate) : "–"}
    </span>
  );
}

type Rows = {
  rows: ForceRow[];
  pinned: string | null;
  shown: string | null;
  events: RowEvents;
  onFocusOut: () => void;
};

function Header() {
  return (
    <div className={cn(GRID, "items-center border-b py-2 text-muted-foreground text-xs")}>
      <span>Rule or skill</span>
      <span className="text-right">Mistakes, 28 days</span>
      <span className="text-right">Used</span>
    </div>
  );
}

function ForceRows({ rows, pinned, shown, events, onFocusOut }: Rows) {
  return rows.map((row) => (
    <a
      key={row.id}
      href={rowHref(row.id)}
      data-row={row.id}
      aria-label={`${row.name}: mistakes ${mistakeWords(row)}, used ${usedWords(row)}`}
      aria-current={pinned === row.id ? "true" : undefined}
      className={cn(
        GRID,
        "relative border-b py-2 text-xs outline-none transition-colors last:border-b-0",
        "hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        shown === row.id && "bg-muted",
        pinned === row.id && "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-foreground",
      )}
      {...rowHandlers(row.id, pinned, events, onFocusOut)}
    >
      <span data-name className="line-clamp-2 text-[0.8125rem]">
        {row.name}
      </span>
      <span data-mistakes className="text-right">
        <Mistakes row={row} />
      </span>
      <span
        data-used
        className={cn(
          "text-right",
          row.trim ? "text-unsure" : row.item.used === null ? "text-muted-foreground" : "font-mono",
        )}
      >
        {usedWords(row)}
      </span>
    </a>
  ));
}

/**
 * Every rule line and skill in force. Only those that need him show: a mistake above its usual range today, or no use
 * in TRIM_DAYS. The rest fold into one closed list, grouped by kind, which opens when a link picks a row in it.
 */
export function InForceTable({
  rows,
  onLeave,
  ...rest
}: Omit<Rows, "rows"> & { rows: ForceRow[]; onLeave: () => void }) {
  const needs = rows.filter(needsHim);
  const fine = rows.filter((row) => !needsHim(row));
  const pickedFine = fine.some((row) => row.id === rest.pinned);
  const [open, setOpen] = useState(pickedFine);
  useEffect(() => {
    if (pickedFine) setOpen(true);
  }, [pickedFine]);
  if (rows.length === 0) return null;
  const unmeasured = fine.filter((row) => row.mistakes.length === 0).length;
  return (
    <section aria-labelledby="in-force" className="grid gap-3" onPointerLeave={onLeave}>
      <h2 id="in-force" className="pt-3 font-semibold text-lg tracking-tight">
        Rules and skills in force
      </h2>
      {needs.length > 0 ? (
        <div data-table data-needs className="overflow-clip rounded-lg border">
          <Header />
          <ForceRows rows={needs} {...rest} />
        </div>
      ) : (
        <p data-needs className="rounded-lg border px-3.5 py-3 text-muted-foreground text-xs">
          Nothing needs you today.
        </p>
      )}
      <details
        data-fine
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
        className="group overflow-clip rounded-lg border"
      >
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3.5 py-2.5 text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
          <ChevronRight
            aria-hidden
            className="size-3.5 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none"
          />
          <span className="font-medium">
            {needs.length
              ? plural(fine.length, "more rule or skill", "more rules and skills")
              : `All ${number(fine.length)} rules and skills`}
          </span>
          <span className="ml-auto text-muted-foreground">{number(unmeasured)} not measured</span>
        </summary>
        <div data-table className="border-t">
          <Header />
          {GROUPS.map(({ kind, title }) => {
            const group = fine.filter((row) => row.item.kind === kind);
            if (!group.length) return null;
            return (
              <div key={kind} data-group={kind}>
                <h3 className="border-b bg-muted/40 px-3.5 py-1.5 font-medium text-muted-foreground text-xs">
                  {title}
                </h3>
                <ForceRows rows={group} {...rest} />
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}
