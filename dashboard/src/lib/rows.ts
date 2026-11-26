import type { Range, Report, Trial } from "@/data/report";
import { type Status, trialStatus } from "./status";

/** The table's groups, in page order. */
export const GROUPS = ["due", "judged"] as const;

export type Group = (typeof GROUPS)[number];

export const GROUP_WORDS: Record<Group, string> = {
  due: "Under test",
  judged: "Verdicts this week",
};

/** A change whose range is known, so a band can be drawn. */
export type Drawn = { value: number; low: number; high: number };

/** One row of the table: a rule change, with the answer it gives. */
export type Row = {
  id: string;
  name: string;
  group: Group;
  status: Status;
  /** Null with no verdict yet: a row without one shows no numbers, so a change under test never shows a lead. */
  change: Drawn | null;
  trial: Trial;
};

/** A name as it appears in a row's id: lower case, with a hyphen for each run of anything else. */
export function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function drawn(status: Status, change: Range | null): Drawn | null {
  if (status === "due" || change?.low == null || change.high == null) return null;
  return { value: change.value, low: change.low, high: change.high };
}

const soonest = (a: Row, b: Row) => a.trial.started.localeCompare(b.trial.started);
const latest = (a: Row, b: Row) => (b.trial.due ?? "").localeCompare(a.trial.due ?? "");

/**
 * Every row in page order: changes under test (earliest started first), then this week's verdicts (latest first). Ids
 * are unique and stable across reports, so a link can name a row.
 */
export function pageRows(report: Report): Row[] {
  const rows = report.trials.map((trial): Row => {
    const status = trialStatus(trial);
    return {
      id: `trial-${slug(trial.name)}`,
      name: trial.name,
      group: status === "due" ? "due" : "judged",
      status,
      change: drawn(status, trial.change),
      trial,
    };
  });
  const seen = new Set<string>();
  // Two rows can share a name (a change tried twice); the later ones get a number so every id stays unique.
  const unique = (id: string) => {
    let candidate = id;
    for (let n = 2; seen.has(candidate); n++) candidate = `${id}-${n}`;
    seen.add(candidate);
    return candidate;
  };
  return GROUPS.flatMap((group) =>
    rows.filter((row) => row.group === group).toSorted(group === "due" ? soonest : latest),
  ).map((row) => ({ ...row, id: unique(row.id) }));
}
