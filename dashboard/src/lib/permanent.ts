import type { Day, PermanentCheck } from "@/data/report";
import type { BadgeTone } from "./change";
import { dayLabel, plural } from "./format";

/** Fewer tasks than this in the smaller group and the range means little. */
export const FEWEST_TASKS = 5;

export type PermanentStatus = "working" | "slipping" | "waiting";

export const STATUS_WORDS: Record<PermanentStatus, string> = {
  working: "Still working",
  slipping: "Slipping",
  waiting: "Waiting for tasks",
};

export const STATUS_TONE: Record<PermanentStatus, BadgeTone> = { working: "good", slipping: "bad", waiting: "waiting" };

/** The text that stands in a permanent check's result cell instead of a strip, or null when a strip is drawn. */
export function permanentNote(check: PermanentCheck): string | null {
  if (check.tasks_without === 0) return "No tasks without the rule yet";
  if (Math.min(check.tasks_with, check.tasks_without) < FEWEST_TASKS || check.change === null) {
    return `Too few tasks to tell (needs ${FEWEST_TASKS})`;
  }
  return null;
}

export function permanentStatus(check: PermanentCheck): PermanentStatus {
  if (check.slipping) return "slipping";
  return permanentNote(check) === null ? "working" : "waiting";
}

/** The model every row was checked on, or null when they differ or one is unknown. */
export function sharedModel(checks: PermanentCheck[]): string | null {
  const models = new Set(checks.map((c) => c.model));
  const [only] = models;
  return models.size === 1 && only ? only : null;
}

/** "5 proven rules, each left off for 1 task in 10 since 12 Nov"; the date only when all share it. */
export function permanentSummary(checks: PermanentCheck[], day: Day): string {
  if (checks.length === 0) return "No proven rules yet";
  const since = new Set(checks.map((c) => c.since));
  const [only] = since;
  const when = since.size === 1 ? ` since ${dayLabel(only, day)}` : "";
  return `${plural(checks.length, "proven rule")}, each left off for 1 task in 10${when}`;
}

/** "2 still working · 1 slipping · 2 waiting for tasks", leaving out the statuses no rule has. */
export function statusCounts(checks: PermanentCheck[]): string {
  const counts = new Map<PermanentStatus, number>();
  for (const check of checks) {
    const status = permanentStatus(check);
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return (["working", "slipping", "waiting"] as const)
    .filter((s) => counts.has(s))
    .map((s) => `${counts.get(s)} ${STATUS_WORDS[s].toLowerCase()}`)
    .join(" · ");
}
