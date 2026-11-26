import type { Trial } from "@/data/report";

/** The four answers a row can give, worst first: the order the pills use (PRODUCT.md, Behaviour). */
export const STATUSES = ["worse", "works", "no-effect", "due"] as const;

export type Status = (typeof STATUSES)[number];

export const STATUS_WORDS: Record<Status, string> = {
  worse: "Worse",
  works: "Works",
  "no-effect": "No big effect",
  due: "Verdict due",
};

/** A change's status is its verdict, never read off its numbers: before day 3 of real use it has no answer. */
export function trialStatus(trial: Trial): Status {
  switch (trial.verdict) {
    case "works":
      return "works";
    case "worse":
      return "worse";
    case "no big effect":
      return "no-effect";
    default:
      return "due";
  }
}
