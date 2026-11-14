import { type CSSProperties, useEffect, useRef } from "react";
import { Detail } from "@/components/detail/detail";
import { textWidth } from "@/components/measure";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { Report } from "@/data/report";
import { useHash, useMedia } from "@/hooks/use-place";
import { attentionItems } from "@/lib/attention";
import { selectHref } from "@/lib/hash";
import { firstPick, pageRows } from "@/lib/rows";
import type { Picking } from "@/sections/rows-section";
import { Sections } from "@/sections/sections";

/** The widest a name column gets; a longer name is cut short with its full text in a tooltip. */
const NAME_CAP = 380;

/** Wide enough for the sections and the detail panel side by side. */
const WIDE = "(min-width: 1200px)";

/** Moves to `hash` without a new history entry, as picking a row should not fill the back button. */
function replaceHash(hash: string) {
  window.history.replaceState(null, "", hash);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

/**
 * The one page: every section's rows on the left, and the picked row in full in a panel that stays in view on the
 * right (on load, the first attention item's row, else the first mistake with a rule). Narrower, nothing is picked
 * until a row is tapped, and the detail opens in a sheet. The pick lives in the hash, so it survives a reload and can
 * be linked; a page address (see `OLD_PAGES` in `lib/hash.ts`) opens the page at its section.
 */
export function Dashboard({ report }: { report: Report }) {
  const place = useHash();
  const wide = useMedia(WIDE);
  const rows = pageRows(report);
  const targets = attentionItems(report).map((i) => i.target);
  const picked = rows.find((r) => r.id === place.selected) ?? (wide ? firstPick(rows, targets) : undefined);
  const lastPicked = useRef<string | null>(null);
  if (picked) lastPicked.current = picked.id;
  // While the sheet slides shut the pick is already cleared; keep showing the last one until it has gone.
  const shown = picked ?? rows.find((r) => r.id === lastPicked.current);
  const rowElement = (id: string | null) => document.querySelector<HTMLElement>(`[data-row="${id}"]`);

  useEffect(() => {
    if (place.section) document.getElementById(`section-${place.section}`)?.scrollIntoView();
  }, [place.section]);

  const picking: Picking = {
    selected: picked?.id ?? null,
    onSelect: (id) => replaceHash(selectHref(id)),
    onMove: (id, step) => {
      const next = rows[rows.findIndex((r) => r.id === id) + step];
      if (!next) return;
      replaceHash(selectHref(next.id));
      rowElement(next.id)?.focus();
    },
  };
  // Every section's name column is as wide as the longest name needs, so the charts get the rest (up to their cap).
  const nameWidth = Math.ceil(Math.min(NAME_CAP, Math.max(0, ...rows.map((r) => textWidth(r.name, 14) * 1.04 + 4))));
  const sections = (
    <div className="@container min-w-0 space-y-10" style={{ "--name-w": `${nameWidth}px` } as CSSProperties}>
      <Sections report={report} rows={rows} picking={picking} />
    </div>
  );
  if (wide && picked) {
    return (
      <div className="grid grid-cols-[minmax(0,840px)_minmax(384px,1fr)] gap-6">
        {sections}
        <aside
          aria-label="Picked row"
          className="sticky top-4 max-h-[calc(100svh-2rem)] self-start overflow-y-auto border-l pl-6"
        >
          {/* Keyed by row, so a chart's hover state never carries over to the next row picked. */}
          <Detail key={picked.id} row={picked} report={report} />
        </aside>
      </div>
    );
  }
  if (wide) return <div className="max-w-[840px]">{sections}</div>;
  return (
    <>
      {sections}
      <Sheet open={picked !== undefined} onOpenChange={(open) => !open && replaceHash(selectHref(null))}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-4 pt-12 data-[side=right]:w-full sm:max-w-lg data-[side=right]:sm:max-w-lg motion-reduce:data-[side=right]:data-ending-style:translate-x-0 motion-reduce:data-[side=right]:data-starting-style:translate-x-0"
          finalFocus={() => rowElement(lastPicked.current)}
        >
          <SheetTitle className="sr-only">{shown?.name ?? "Detail"}</SheetTitle>
          {shown && <Detail key={shown.id} row={shown} report={report} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
