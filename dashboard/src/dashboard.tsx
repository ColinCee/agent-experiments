import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Pills } from "@/components/pills";
import { PageFacts, RuleCard } from "@/components/rule-card";
import { RuleTable } from "@/components/rule-table";
import { SkillCard } from "@/components/skill-card";
import { SkillTable } from "@/components/skill-table";
import type { Report } from "@/data/report";
import { useHash, useMedia } from "@/hooks/use-place";
import { pickedRow } from "@/lib/hash";
import { pageRows } from "@/lib/rows";
import { skillRows } from "@/lib/skills";
import { STATUSES, type Status } from "@/lib/status";
import { cn } from "@/lib/utils";

/** Wide enough for the table and the card side by side; narrower, the card is its own screen. */
const WIDE = "(min-width: 1100px)";

// Long enough that crossing rows on the way to the card does not flicker through each of them.
const PREVIEW_AFTER = 70;
// Long enough to cross the gap between the table and the card.
const LET_GO_AFTER = 220;

/**
 * The one page (PRODUCT.md, Behaviour): a table of every experiment and active rule, and beside it a card for the
 * row under the pointer or focus. A click keeps a row's card and puts it in the address, so a link opens it.
 */
export function Dashboard({ report }: { report: Report }) {
  const rows = useMemo(() => pageRows(report), [report]);
  const skills = useMemo(() => skillRows(report), [report]);
  const pinned = pickedRow(useHash(), [...rows.map((row) => row.id), ...skills.map((row) => row.id)]);
  const wide = useMedia(WIDE);
  const [previewed, setPreviewed] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status | null>(null);
  const [lit, setLit] = useState<Status | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const preview = (id: string | null, after: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPreviewed(id), after);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const shownId = (wide ? previewed : null) ?? pinned;
  const shown = rows.find((row) => row.id === shownId);
  const shownSkill = skills.find((row) => row.id === shownId);
  const counts = Object.fromEntries(
    STATUSES.map((status) => [status, rows.filter((row) => row.status === status).length]),
  ) as Record<Status, number>;

  const toggleFilter = (status: Status) => {
    const apply = () => flushSync(() => setFilter((now) => (now === status ? null : status)));
    setLit(null);
    // Rows slide to their new places where the browser can; elsewhere, and for reduced motion, they just change.
    if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.startViewTransition(apply);
    } else {
      apply();
    }
  };

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
    <div className="grid gap-4">
      {!alone && <Pills counts={counts} filter={filter} onLight={setLit} onFilter={toggleFilter} />}
      <div className="grid items-start gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_22.5rem]">
        {!alone && (
          <div className="grid gap-6">
            <RuleTable
              rows={filter ? rows.filter((row) => row.status === filter) : rows}
              pinned={pinned}
              shown={shownId}
              lit={lit}
              events={events}
              onLeave={() => preview(null, LET_GO_AFTER)}
              onFocusOut={() => preview(null, 0)}
            />
            <SkillTable
              rows={filter ? [] : skills}
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
            aria-label={shown ? "Rule in full" : shownSkill ? "Skill in full" : "About this page"}
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
            ) : shownSkill ? (
              <SkillCard key={shownSkill.id} row={shownSkill} day={report.day} />
            ) : (
              <PageFacts report={report} />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
