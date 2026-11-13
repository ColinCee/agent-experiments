import type { Day, PermanentCheck } from "@/data/report";
import { type BadgeTone, FEWEST_TASKS, missingChange } from "./change";
import { dayLabel } from "./format";

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

/** The permanent check's one line: "Proven rules, each left off for 1 task in 10 since 12 Nov"; the date when shared. */
export function permanentSummary(checks: PermanentCheck[], day: Day): string {
  const since = new Set(checks.map((c) => c.since));
  const [only] = since;
  const when = since.size === 1 ? ` since ${dayLabel(only, day)}` : "";
  return `Proven rules, each left off for 1 task in 10${when}`;
}

/** The reason in a proven rule's row where no strip is drawn: as in its detail, but short where the status says the rest. */
export function permanentRowNote(check: PermanentCheck): string | null {
  return permanentStatus(check) === "nothing" ? "No mistakes without the rule" : permanentNote(check);
}
