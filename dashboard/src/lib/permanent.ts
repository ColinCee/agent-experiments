import type { Day, PermanentCheck } from "@/data/report";
import { FEWEST_TASKS } from "./change";
import type { TrendRow } from "./charts";
import { dayLabel } from "./format";

/** `nothing`: enough tasks, but no mistakes without the rule, so there is nothing to compare against. */
export type PermanentStatus = "working" | "slipping" | "waiting" | "nothing";

export function permanentStatus(check: PermanentCheck): PermanentStatus {
  if (check.slipping) return "slipping";
  if (Math.min(check.tasks_with, check.tasks_without) < FEWEST_TASKS) return "waiting";
  return check.change === null ? "nothing" : "working";
}

/** An active rule's chart rows, one a day labelled by its date, and every 7th label back from the last on the axis. */
export function checkRows(check: PermanentCheck, reportDay: Day): { rows: TrendRow[]; ticks: string[] } {
  const rows = check.trend.map((t) => ({ label: dayLabel(t.day, reportDay), with: t.with, without: t.without }));
  return { rows, ticks: rows.filter((_, i) => (rows.length - 1 - i) % 7 === 0).map((r) => r.label) };
}
