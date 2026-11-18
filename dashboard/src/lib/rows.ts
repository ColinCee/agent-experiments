import type { PermanentCheck, Range, Report, Trial } from "@/data/report";
import { ruleStatus, STATUSES, type Status, trialStatus } from "./status";
import { sortTrials } from "./trials";

/** The table's groups, in page order. */
export const GROUPS = ["running", "active", "finished"] as const;

export type Group = (typeof GROUPS)[number];

export const GROUP_WORDS: Record<Group, string> = {
  running: "Running experiments",
  active: "Active rules",
  finished: "Finished experiments",
};

/** A change whose range is known, so a band can be drawn. */
export type Drawn = { value: number; low: number; high: number };

/** One row of the table: an experiment or an active rule, with the answer it gives. */
export type Row = {
  id: string;
  name: string;
  group: Group;
  status: Status;
  /** Null with no answer yet: a row without an answer shows no numbers, so a running experiment never shows a lead. */
  change: Drawn | null;
} & ({ kind: "trial"; trial: Trial } | { kind: "permanent"; check: PermanentCheck });

/** A name as it appears in a row's id: lower case, with a hyphen for each run of anything else. */
export function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function drawn(status: Status, change: Range | null): Drawn | null {
  if (status === "not-enough" || change?.low == null || change.high == null) return null;
  return { value: change.value, low: change.low, high: change.high };
}

/**
 * Every row in page order: experiments not yet finished (running first), active rules (not working first), then
 * finished experiments (latest first). Ids are unique and stable across reports, so a link can name a row.
 */
export function pageRows(report: Report): Row[] {
  const trials = sortTrials(report.trials).map((trial): Row => {
    const status = trialStatus(trial);
    return {
      kind: "trial",
      id: `trial-${slug(trial.name)}`,
      name: trial.name,
      group: trial.state === "finished" ? "finished" : "running",
      status,
      change: drawn(status, trial.change),
      trial,
    };
  });
  const rules = report.permanent
    .map((check): Row => {
      const status = ruleStatus(check);
      return {
        kind: "permanent",
        id: `permanent-${slug(check.name)}`,
        name: check.name,
        group: "active",
        status,
        change: drawn(status, check.change),
        check,
      };
    })
    .toSorted((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status));
  const seen = new Set<string>();
  // Two rows can share a name (an experiment run twice); the later ones get a number so every id stays unique.
  const unique = (id: string) => {
    let candidate = id;
    for (let n = 2; seen.has(candidate); n++) candidate = `${id}-${n}`;
    seen.add(candidate);
    return candidate;
  };
  return GROUPS.flatMap((group) => [...trials, ...rules].filter((row) => row.group === group)).map((row) => ({
    ...row,
    id: unique(row.id),
  }));
}
