import type { Day, PermanentCheck } from "@/data/report";
import { type BadgeTone, FEWEST_TASKS, missingChange } from "./change";
import { dayLabel, plural } from "./format";

export type PermanentStatus = "working" | "slipping" | "waiting" | "nothing";

export const STATUS_WORDS: Record<PermanentStatus, string> = {
  working: "Still working",
  slipping: "Slipping",
  waiting: "Waiting for tasks",
  nothing: "Nothing to compare",
};

export const STATUS_TONE: Record<PermanentStatus, BadgeTone> = {
  working: "good",
  slipping: "bad",
  waiting: "waiting",
  nothing: "unclear",
};

/** The text that stands in a permanent check's result cell instead of a strip, or null when a strip is drawn. */
export function permanentNote(check: PermanentCheck): string | null {
  if (check.tasks_without === 0) return "No tasks without the rule yet";
  const smaller = Math.min(check.tasks_with, check.tasks_without);
  if (smaller < FEWEST_TASKS) return `Too few tasks to tell (needs ${FEWEST_TASKS})`;
  return check.change === null ? missingChange(smaller, "without the rule") : null;
}

export function permanentStatus(check: PermanentCheck): PermanentStatus {
  if (check.slipping) return "slipping";
  if (check.change === null && Math.min(check.tasks_with, check.tasks_without) >= FEWEST_TASKS) return "nothing";
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
  return (["working", "slipping", "waiting", "nothing"] as const)
    .filter((s) => counts.has(s))
    .map((s) => `${counts.get(s)} ${STATUS_WORDS[s].toLowerCase()}`)
    .join(" · ");
}
