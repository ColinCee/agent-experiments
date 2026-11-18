import type { PermanentCheck, Trial } from "@/data/report";
import { permanentStatus } from "./permanent";

/** The four answers a row can give, worst first: the order the pills and the active rules use (PRODUCT.md, Behaviour). */
export const STATUSES = ["not-working", "works", "cant-tell", "not-enough"] as const;

export type Status = (typeof STATUSES)[number];

export const STATUS_WORDS: Record<Status, string> = {
  "not-working": "Not working",
  works: "Works",
  "cant-tell": "Can't tell",
  "not-enough": "Not enough tasks",
};

/** An experiment's status is its latest verdict, never read off its numbers: before a verdict it has no answer. */
export function trialStatus(trial: Trial): Status {
  switch (trial.verdict) {
    case "works":
      return "works";
    case "no useful effect":
      return "not-working";
    case "can't tell":
      return "cant-tell";
    default:
      return "not-enough";
  }
}

/** An active rule works until its range rules out a 30% cut, so a rule that works can have a band across no change. */
export function ruleStatus(check: PermanentCheck): Status {
  const status = permanentStatus(check);
  return status === "working" ? "works" : status === "slipping" ? "not-working" : "not-enough";
}
