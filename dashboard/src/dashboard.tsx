import { useEffect, useMemo, useRef, useState } from "react";
import { InForceCard } from "@/components/in-force-card";
import { InForceTable } from "@/components/in-force-table";
import { PageFacts, RuleCard } from "@/components/rule-card";
import { RuleTable } from "@/components/rule-table";
import type { Report } from "@/data/report";
import { useHash, useMedia } from "@/hooks/use-place";
import { pickedRow } from "@/lib/hash";
import { forceRows } from "@/lib/in-force";
import { pageRows } from "@/lib/rows";
import { cn } from "@/lib/utils";

/** Wide enough for the table and the card side by side; narrower, the card is its own screen. */
const WIDE = "(min-width: 1100px)";

// Long enough that crossing rows on the way to the card does not flicker through each of them.
const PREVIEW_AFTER = 70;
// Long enough to cross the gap between the table and the card.
const LET_GO_AFTER = 220;

/**
 * The one page (PRODUCT.md, Behaviour): the rule changes being tested, and beside them a card for the row under the
 * pointer or focus. A click keeps a row's card and puts it in the address.
 */
export function Dashboard({ report }: { report: Report }) {
  const rows = useMemo(() => pageRows(report), [report]);
  const force = useMemo(() => forceRows(report), [report]);
  const pinned = pickedRow(useHash(), [...rows.map((row) => row.id), ...force.map((row) => row.id)]);
  const wide = useMedia(WIDE);
  const [previewed, setPreviewed] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const preview = (id: string | null, after: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPreviewed(id), after);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const shownId = (wide ? previewed : null) ?? pinned;
  const shown = rows.find((row) => row.id === shownId);
  const shownForce = force.find((row) => row.id === shownId);

  const events = {
    onPreview: (id: string) => preview(id, PREVIEW_AFTER),
    onFocusRow: (id: string) => preview(id, 0),
    onToggle: () => {
      window.location.hash = "";
    },
  };

  const alone = !wide && pinned !== null;
  const card = useRef<HTMLElement>(null);
  const cameFrom = useRef<string | null>(null);
  // Swapping the table for the card, and back, removes whatever had focus; put it on what replaced it.
  useEffect(() => {
    if (alone) {
      cameFrom.current = pinned;
      window.scrollTo(0, 0);
      card.current?.focus();
    } else if (cameFrom.current) {
      document.querySelector<HTMLElement>(`[data-row="${cameFrom.current}"]`)?.focus();
      cameFrom.current = null;
    }
  }, [alone, pinned]);
  return (
    <div className="grid items-start gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_22.5rem]">
      {!alone && (
        <div className="grid gap-6">
          <RuleTable
            rows={rows}
            day={report.day}
            pinned={pinned}
            shown={shownId}
            events={events}
            onLeave={() => preview(null, LET_GO_AFTER)}
            onFocusOut={() => preview(null, 0)}
          />
          <InForceTable
            rows={force}
            pinned={pinned}
            shown={shownId}
            events={events}
            onLeave={() => preview(null, LET_GO_AFTER)}
            onFocusOut={() => preview(null, 0)}
          />
        </div>
      )}
      {(wide || alone) && (
        <aside
          aria-label={shown ? "Rule change in full" : shownForce ? "Rule or skill in full" : "About this page"}
          ref={card}
          tabIndex={-1}
          className={cn(
            "rounded-lg border outline-none",
            wide && "sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto",
          )}
          onPointerEnter={() => window.clearTimeout(timer.current)}
          onPointerLeave={() => preview(null, LET_GO_AFTER)}
        >
          {shown ? (
            <RuleCard key={shown.id} row={shown} day={report.day} />
          ) : shownForce ? (
            <InForceCard key={shownForce.id} row={shownForce} day={report.day} />
          ) : (
            <PageFacts report={report} />
          )}
        </aside>
      )}
    </div>
  );
}
