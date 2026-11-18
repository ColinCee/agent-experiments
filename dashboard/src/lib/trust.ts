import type { PermanentCheck, Trial } from "@/data/report";
import { FEWEST_TASKS } from "./change";
import { plural } from "./format";
import { MOST_NEEDED } from "./trials";

/** The card's "Can it be trusted" section, one shape for an experiment and an active rule. */
export interface Trust {
  with: number;
  without: number;
  needed: number;
  neededWords: string;
  enough: string;
}

export function trialTrust(trial: Trial): Trust {
  const needed = trial.needed ?? MOST_NEEDED;
  const short = needed - Math.min(trial.tasks_with, trial.tasks_without);
  const weeks = Math.ceil(short / trial.per_week);
  const enough =
    short <= 0 && trial.needed !== null
      ? "Yes"
      : trial.state === "finished"
        ? "Ended short"
        : trial.needed !== null && Number.isFinite(weeks)
          ? `In about ${plural(weeks, "week")}`
          : "Not at this pace";
  return {
    with: trial.tasks_with,
    without: trial.tasks_without,
    needed,
    neededWords: trial.needed === null ? `over ${MOST_NEEDED} needed` : `${needed} needed`,
    enough,
  };
}

// The report gives an active rule no number needed, so its line is the fewest tasks a side can be judged on.
export function ruleTrust(check: PermanentCheck): Trust {
  return {
    with: check.tasks_with,
    without: check.tasks_without,
    needed: FEWEST_TASKS,
    neededWords: `${FEWEST_TASKS} at least`,
    enough: Math.min(check.tasks_with, check.tasks_without) >= FEWEST_TASKS ? "Yes" : "Not yet",
  };
}
