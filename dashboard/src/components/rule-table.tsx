import { signedPercent } from "@/lib/format";
import { rowHref } from "@/lib/hash";
import { GROUP_WORDS, GROUPS, type Row } from "@/lib/rows";
import { STATUS_WORDS, type Status } from "@/lib/status";
import { cn } from "@/lib/utils";
import { Band, Scale } from "./band";
import { STATUS_TONE, StatusIcon } from "./status-icon";

// One grid for the header and every row, so each band sits under the scale. On a phone the band takes a second line.
const GRID =
  "grid grid-cols-[minmax(0,1fr)_3.5rem_1rem] items-center gap-x-4 px-3.5 sm:grid-cols-[minmax(0,1fr)_17rem_3.5rem_1rem]";

export interface RowEvents {
  onPreview: (id: string) => void;
  onFocusRow: (id: string) => void;
  onToggle: (id: string) => void;
}

/** Every experiment and active rule, one row each, group by group. */
export function RuleTable({
  rows,
  pinned,
  shown,
  lit,
  events,
  onLeave,
  onFocusOut,
}: {
  rows: Row[];
  pinned: string | null;
  shown: string | null;
  lit: Status | null;
  events: RowEvents;
  onLeave: () => void;
  onFocusOut: () => void;
}) {
  if (rows.length === 0) {
    return <p className="rounded-lg border px-3.5 py-6 text-muted-foreground">No experiments or active rules yet.</p>;
  }
  return (
    <div data-table className="overflow-clip rounded-lg border" onPointerLeave={onLeave}>
      <div className={cn(GRID, "h-9 border-b text-muted-foreground text-xs max-sm:hidden")}>
        <span>Rule</span>
        <Scale />
        <span className="text-right">Change</span>
      </div>
      {GROUPS.map((group) => {
        const inGroup = rows.filter((row) => row.group === group);
        if (inGroup.length === 0) return null;
        return (
          <section key={group} data-group={group} aria-label={GROUP_WORDS[group]} className="border-b last:border-b-0">
            <h2
              className="border-b bg-muted px-3.5 py-1.5 font-medium text-muted-foreground text-xs"
              style={{ viewTransitionName: `group-${group}` }}
            >
              {GROUP_WORDS[group]}
            </h2>
            {inGroup.map((row) => (
              <a
                key={row.id}
                href={rowHref(row.id)}
                data-row={row.id}
                data-status={row.status}
                aria-label={`${row.name}, ${row.change ? `${signedPercent(row.change.value)}, ` : ""}${STATUS_WORDS[row.status]}`}
                aria-current={pinned === row.id ? "true" : undefined}
                className={cn(
                  GRID,
                  "relative min-h-10 border-b py-2 outline-none transition-[background-color,opacity] last:border-b-0",
                  "hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  shown === row.id && "bg-muted",
                  pinned === row.id &&
                    "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-foreground",
                  lit !== null && lit !== row.status && "opacity-30",
                )}
                style={{ viewTransitionName: `row-${row.id}` }}
                onPointerEnter={(event) => event.pointerType === "mouse" && events.onPreview(row.id)}
                onFocus={(event) => event.currentTarget.matches(":focus-visible") && events.onFocusRow(row.id)}
                onBlur={(event) =>
                  !event.currentTarget.closest("[data-table]")?.contains(event.relatedTarget) && onFocusOut()
                }
                onClick={(event) => {
                  // A second click on the kept row lets go of it; any other click follows the link.
                  if (pinned !== row.id || event.metaKey || event.ctrlKey) return;
                  event.preventDefault();
                  events.onToggle(row.id);
                }}
              >
                <span data-name className="font-medium">
                  {row.name}
                </span>
                {row.change && (
                  <span className="max-sm:col-span-3 max-sm:row-start-2 max-sm:mt-1.5 sm:col-start-2">
                    <Band change={row.change} status={row.status} />
                  </span>
                )}
                <span
                  data-change
                  className={cn("text-right font-medium font-mono sm:col-start-3", STATUS_TONE[row.status])}
                >
                  {row.change ? signedPercent(row.change.value) : "–"}
                </span>
                <span className="sm:col-start-4">
                  <StatusIcon status={row.status} />
                </span>
              </a>
            ))}
          </section>
        );
      })}
    </div>
  );
}
