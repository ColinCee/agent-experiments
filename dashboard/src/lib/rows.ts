import type { Mistake, PermanentCheck, Replay, Report, Sizes, Trial } from "@/data/report";
import type { SectionId } from "./hash";
import { slug, sortByChange, withoutRule, withRule } from "./mistakes";
import { sortTrials } from "./trials";

/** One row of the page: a thing that can be picked and shown in full in the detail panel. */
export type Row = { id: string; name: string; section: SectionId } & (
  | { kind: "trial"; trial: Trial }
  | { kind: "permanent"; check: PermanentCheck }
  | { kind: "mistake"; mistake: Mistake }
  | { kind: "replay"; replay: Replay }
  | { kind: "size"; series: Sizes["series"][number] }
);

export type RowKind = Row["kind"];

/** A row's id, unique on the page and stable across reports, so a picked row can live in the hash. */
export const rowId = (kind: RowKind, name: string) => `${kind}-${slug(name)}`;

/**
 * Every row on the page, section by section in page order: trials (running first), proven rules, mistakes with a rule
 * (clearly fewer first), mistakes with no rule yet, replays and the two sizes. Up and Down walk this order.
 */
export function pageRows(report: Report): Row[] {
  const seen = new Set<string>();
  // Two rows can share a name (a trial run twice); the later ones get a number so every id stays unique.
  const unique = (id: string) => {
    let candidate = id;
    for (let n = 2; seen.has(candidate); n++) candidate = `${id}-${n}`;
    seen.add(candidate);
    return candidate;
  };
  const rows: Row[] = [
    ...sortTrials(report.trials).map((trial) => ({
      kind: "trial" as const,
      id: rowId("trial", trial.name),
      name: trial.name,
      section: "trials" as const,
      trial,
    })),
    ...report.permanent.map((check) => ({
      kind: "permanent" as const,
      id: rowId("permanent", check.name),
      name: check.name,
      section: "permanent" as const,
      check,
    })),
    ...sortByChange(withRule(report.mistakes)).map((mistake) => ({
      kind: "mistake" as const,
      id: rowId("mistake", mistake.name),
      name: mistake.name,
      section: "rules" as const,
      mistake,
    })),
    ...withoutRule(report.mistakes).map((mistake) => ({
      kind: "mistake" as const,
      id: rowId("mistake", mistake.name),
      name: mistake.name,
      section: "no-rule" as const,
      mistake,
    })),
    ...report.replays.map((replay) => ({
      kind: "replay" as const,
      id: rowId("replay", replay.name),
      name: replay.name,
      section: "replays" as const,
      replay,
    })),
    ...report.sizes.series.map((series) => ({
      kind: "size" as const,
      id: rowId("size", series.label),
      name: series.label,
      section: "size" as const,
      series,
    })),
  ];
  return rows.map((row) => ({ ...row, id: unique(row.id) }));
}

/**
 * The row picked when nothing is: the one the first attention item is about, else the first mistake with a rule,
 * else the first row of all.
 */
export function firstPick(rows: Row[], attentionTargets: string[]): Row | undefined {
  const byId = (id: string) => rows.find((r) => r.id === id);
  return attentionTargets.map(byId).find(Boolean) ?? rows.find((r) => r.section === "rules") ?? rows[0];
}
