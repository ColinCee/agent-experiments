import type { PermanentCheck } from "@/data/report";
import { FEWEST_TASKS } from "./change";

/** `nothing`: enough tasks, but no mistakes without the rule, so there is nothing to compare against. */
export type PermanentStatus = "working" | "slipping" | "waiting" | "nothing";

export function permanentStatus(check: PermanentCheck): PermanentStatus {
  if (check.slipping) return "slipping";
  if (Math.min(check.tasks_with, check.tasks_without) < FEWEST_TASKS) return "waiting";
  return check.change === null ? "nothing" : "working";
}
