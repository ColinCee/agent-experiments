import type { Range, Report, Trial } from "@/data/report";
import { type Status, trialStatus } from "./status";

/** A change whose range is known, so a band can be drawn. */
export type Drawn = { value: number; low: number; high: number };

/** One row of the table: a rule change, with the answer it gives. */
export type Row = {
  id: string;
  /** The change in plain words, or the mistake it targets when nothing words the change. */
  name: string;
  status: Status;
  /** Null with no verdict yet. */
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

const order = (a: Row, b: Row) =>
  Number(a.status !== "due") - Number(b.status !== "due") ||
  (a.status === "due" ? a.trial.started.localeCompare(b.trial.started) : b.trial.due.localeCompare(a.trial.due));

/**
 * Every row in page order: changes awaiting a verdict (earliest started first), then this week's verdicts (latest
 * first). Ids are unique and stable across reports, so a link can name a row.
 */
export function pageRows(report: Report): Row[] {
  const seen = new Set<string>();
  // Two rows can share a name (a change tried twice); the later ones get a number so every id stays unique.
  const unique = (id: string) => {
    let candidate = id;
    for (let n = 2; seen.has(candidate); n++) candidate = `${id}-${n}`;
    seen.add(candidate);
    return candidate;
  };
  return report.trials
    .map((trial): Row => {
      const status = trialStatus(trial);
      return { id: "", name: trial.what ?? trial.name, status, change: drawn(status, trial.change), trial };
    })
    .toSorted(order)
    .map((row) => ({ ...row, id: unique(`trial-${slug(row.trial.name)}`) }));
}
