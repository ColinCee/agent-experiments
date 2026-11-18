import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Day, PermanentCheck, Trial } from "@/data/report";
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

/** Days an active rule's numbers look back over; the report counts the last 28. */
const CHECK_DAYS = 28;

/**
 * An active rule's sides only grow while it is younger than the days its numbers look back over; after that, a side
 * short of the tasks it needs stays short at the same pace.
 */
export function ruleTrust(check: PermanentCheck, day: Day): Trust {
  const needed = check.needed ?? MOST_NEEDED;
  const fewer = Math.min(check.tasks_with, check.tasks_without);
  // Its sides count at most the last 28 days, so its pace is over those, however old it is.
  const age = Math.min(CHECK_DAYS, differenceInCalendarDays(parseISO(day), parseISO(check.since)) + 1);
  const atFull = (fewer / age) * CHECK_DAYS;
  const weeks = Math.ceil((needed - fewer) / (fewer / age) / 7);
  const enough =
    fewer >= needed && check.needed !== null
      ? "Yes"
      : check.needed !== null && atFull >= needed && Number.isFinite(weeks)
        ? `In about ${plural(weeks, "week")}`
        : "Not at this pace";
  return {
    with: check.tasks_with,
    without: check.tasks_without,
    needed,
    neededWords: check.needed === null ? `over ${MOST_NEEDED} needed` : `${needed} needed`,
    enough,
  };
}
