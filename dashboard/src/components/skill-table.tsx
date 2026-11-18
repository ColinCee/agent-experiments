import type { Side } from "@/data/report";
import { percent } from "@/lib/format";
import { rowHref } from "@/lib/hash";
import type { SkillRow } from "@/lib/skills";
import { cn } from "@/lib/utils";
import { GRID, type RowEvents, rowHandlers } from "./rule-table";

const at = (rate: number) => `${rate * 100}%`;
const TICKS = [0, 0.25, 0.5, 0.75, 1];

/** A rate and its 90% range on a scale from none to every time; neutral, since a rate alone is not a verdict. */
export function RateBand({ side, large = false }: { side: Side; large?: boolean }) {
  const low = side.low ?? side.rate;
  const high = side.high ?? side.rate;
  return (
    <div data-track="rate" className={cn("relative", large ? "h-6" : "h-4")}>
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
      <span
        data-range
        className={cn(
          "absolute top-1/2 -translate-y-1/2 rounded-full bg-foreground opacity-30",
          large ? "h-2.5" : "h-1.5",
        )}
        style={{ left: at(low), width: at(high - low) }}
      />
      <span
        data-value={side.rate}
        className={cn(
          "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground",
          large ? "size-2" : "size-1.5",
        )}
        style={{ left: at(side.rate) }}
      />
    </div>
  );
}

function RateScale() {
  return (
    <div
      data-axis
      title="Share of tasks that needed the skill and did without it"
      className="relative h-4 font-mono text-xs"
    >
      {TICKS.map((tick, i) => (
        <span
          key={tick}
          className={cn(
            "absolute top-0",
            i === 0 ? "" : i === TICKS.length - 1 ? "-translate-x-full" : "-translate-x-1/2",
          )}
          style={{ left: at(tick) }}
        >
          {percent(tick)}
        </span>
      ))}
    </div>
  );
}

/** Every skill the page tracks, one row each: how often it was missed when its moment came, over the last 28 days. */
export function SkillTable({
  rows,
  pinned,
  shown,
  events,
  onLeave,
  onFocusOut,
}: {
  rows: SkillRow[];
  pinned: string | null;
  shown: string | null;
  events: RowEvents;
  onLeave: () => void;
  onFocusOut: () => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section data-table aria-label="Skills" className="overflow-clip rounded-lg border" onPointerLeave={onLeave}>
      <div className={cn(GRID, "h-9 border-b text-muted-foreground text-xs max-sm:hidden")}>
        <span>Skill</span>
        <RateScale />
        <span className="text-right">Missed</span>
      </div>
      <h2 className="border-b bg-muted px-3.5 py-1.5 font-medium text-muted-foreground text-xs">
        Skills not loaded when needed, last 28 days
      </h2>
      {rows.map((row) => {
        const { now } = row.skill;
        return (
          <a
            key={row.id}
            href={rowHref(row.id)}
            data-row={row.id}
            aria-label={`${row.name}, ${now ? `missed ${percent(now.rate)}` : "no tasks yet"}`}
            aria-current={pinned === row.id ? "true" : undefined}
            className={cn(
              GRID,
              "relative min-h-10 border-b py-2 outline-none transition-[background-color] last:border-b-0",
              "hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              shown === row.id && "bg-muted",
              pinned === row.id && "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-foreground",
            )}
            {...rowHandlers(row.id, pinned, events, onFocusOut)}
          >
            <span data-name className="font-medium">
              {row.name}
            </span>
            {now && (
              <span className="max-sm:col-span-3 max-sm:row-start-2 max-sm:mt-1.5 sm:col-start-2">
                <RateBand side={now} />
              </span>
            )}
            <span data-rate className="text-right font-medium font-mono sm:col-start-3">
              {now ? percent(now.rate) : "–"}
            </span>
          </a>
        );
      })}
    </section>
  );
}
