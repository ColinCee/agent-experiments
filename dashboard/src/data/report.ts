// The report `agent-experiments daily` writes (its source of truth: `build()` in src/agent_experiments/cli.py). Facts
// only: rates and changes are fractions, dates are YYYY-MM-DD, and every rate is a mistake rate, so lower is always
// better. A change is after / before - 1 (or with / without - 1).

export type Day = string;

/** 90% range; low and high are null when there are too few tasks. */
export type Range = { value: number; low: number | null; high: number | null };

export type Verdict = "works" | "no useful effect" | "can't tell" | "no verdict yet";

export interface Report {
  /** The data runs up to this day. */
  day: Day;
  /** ISO timestamp when the file was written. */
  written: string;
  /** On `day`. */
  sessions: { total: number; in_group: number; split_since: Day | null };
  trials: Trial[];
  /** Rules proven earlier, each kept off for 1 task in 10. */
  permanent: PermanentCheck[];
  mistakes: Mistake[];
  replays: Replay[];
  sizes: Sizes;
}

export interface Trial {
  /** The mistake it targets, in plain words. */
  name: string;
  started: Day;
  /** started + 7 days, the day of the last look. */
  ends: Day;
  state: "scheduled" | "running" | "finished";
  /** Latest look's verdict; null before any look. */
  verdict: Verdict | null;
  tasks_with: number;
  tasks_without: number;
  rate_with: number | null;
  rate_without: number | null;
  /** Null until each half has 2 tasks, or when there were no mistakes without the rule. */
  change: Range | null;
  /** Tasks per half to detect a true halving; null if over 320. */
  needed: number | null;
  /** Tasks per half a week usually brings. */
  per_week: number;
  looks: { look: number; day: Day; verdict: Verdict; tasks_with: number; tasks_without: number }[];
  /** 3-day rolling rates since start; empty if scheduled. */
  trend: { day: Day; with: number | null; without: number | null }[];
}

export interface PermanentCheck {
  name: string;
  since: Day;
  model: string | null;
  tasks_with: number;
  tasks_without: number;
  change: Range | null;
  /** The range rules out a 30% drop: the rule no longer earns its place. */
  slipping: boolean;
}

export interface Side {
  rate: number;
  low: number | null;
  high: number | null;
  tasks: number;
  from: Day;
}

export interface MistakeChange {
  day: Day;
  what: string;
  kind: "rule" | "trial";
}

export interface Mistake {
  name: string;
  /** `day`'s rate against its usual range; null with no chances that day or under 10 tasks of history. */
  today: { rate: number; usual_low: number; usual_high: number; outside: "above" | "below" | null } | null;
  /** Latest rule change (never a trial's start); null with no rule yet. */
  rule: { day: Day; what: string } | null;
  /** With a rule: before vs since its latest change. */
  before: Side | null;
  after: Side | null;
  change: Range | null;
  /** The change's range excludes 0. */
  sure: boolean;
  /** No rule: the rate over the last 28 days. */
  current: Side | null;
  /** 6 weeks, 3-day rolling. */
  series: { day: Day; rate: number | null }[];
  /** Every rule change and trial start inside the series window; a trial's `what` is the trial's name. */
  changes: MistakeChange[];
}

export interface Replay {
  name: string;
  day: Day;
  verdict: "works" | "no useful effect" | "can't tell" | "replay can't test this";
  /** False when the replay did not reproduce the real rate. */
  trusted: boolean;
  /** What agents really did under the rules in force. */
  real_rate: number | null;
  /** What the replay did under the same rules. */
  replay_rate: number | null;
  rate_old: number | null;
  rate_new: number | null;
  moments: number;
  paired: number;
  /** new / old - 1. */
  change: Range | null;
}

export interface Sizes {
  series: { label: "Rules" | "Skills"; now: number; points: { day: Day; words: number }[] }[];
  largest: { file: string; words: number }[];
  /** Per month (YYYY-MM): edits, the share of them that only added lines, and the share of changed lines added. */
  months: { month: string; label: "Rules" | "Skills"; changes: number; only_added: number; added_share: number }[];
}
