// The report `agent-experiments daily` writes (its source of truth: `build()` in src/agent_experiments/cli.py). Facts
// only: rates and changes are fractions, dates are YYYY-MM-DD, and every rate is a mistake rate, so lower is always
// better. A change is after / before - 1.

export type Day = string;

/** 90% range; low and high are null when there are too few tasks. */
export type Range = { value: number; low: number | null; high: number | null };

export type Verdict = "works" | "worse" | "no big effect";

/** A session with one of the latest mistakes since the change; its last day with one. */
export type Miss = { day: Day; session: string };

export interface Report {
  /** The data runs up to this day. */
  day: Day;
  /** ISO timestamp when the file was written. */
  written: string;
  /** Typed in on `day`, and how many of them the trial hook stamped. */
  sessions: { total: number; stamped: number };
  /** Rule changes, with a trial file or without, still awaiting a verdict, or started or given one in the last 7 days. */
  trials: Trial[];
  mistakes: Mistake[];
  replays: Replay[];
  sizes: Sizes;
  /** Each version of the stop rules, oldest first. */
  stops: StopVersion[];
}

/** A version of the rules on when an agent stops, and how often he had to nudge an agent that stopped under it. */
export interface StopVersion {
  version: string;
  from: Day;
  /** What it changed, in plain words. */
  what: string;
  /** Stops a labeller model judged, over the version's days. */
  stops: number;
  /** The share he had to nudge on; null under 50 stops. */
  rate: number | null;
}

/** A rule change, judged by its mistake rate before against its first three days of real use. */
export interface Trial {
  /** The mistake it targets, in plain words. */
  name: string;
  /** The change, in plain words; null when the measures file dates none. */
  what: string | null;
  /** The day the change reached every task. */
  started: Day;
  status: "testing" | "settled";
  /** Its third day of real use, the verdict's day; until reached, the day it falls on if every day from here has use. */
  due: Day;
  /** Days of real use since the start, at most 3. */
  real_days: number;
  /** Under 2 chances a day: three days hold too few, so a replay tests it. */
  rare: boolean;
  /** From the earlier rule change, or 6 weeks back, to the day before the start. */
  before: Side | null;
  /** From the start to `due`, or to the report's day until then; null before the start. */
  after: Side | null;
  /** after / before - 1, once judged. */
  change: Range | null;
  verdict: Verdict | null;
  source: "before and after" | "replay" | null;
  /** The latest replay of its wording. */
  replay: Replay | null;
  /** Up to 5 sessions since the start, latest first. */
  misses: Miss[];
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
