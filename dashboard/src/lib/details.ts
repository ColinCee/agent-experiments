import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import type { Day, Mistake, PermanentCheck, Replay, Sizes, Trial } from "@/data/report";
import { changeWords } from "./change";
import { dayLabel, monthLabel, number, percent, plural } from "./format";
import { fewTasksNote, missingMistakeChange } from "./mistakes";
import { permanentStatus, STATUS_WORDS } from "./permanent";
import { trialBadge, trialDay, verdictWords } from "./trials";

// The words of the detail panel, kind by kind, in the panel's one shape: a headline (a big answer and a few plain
// words after it), one line on what the thing is, and a list of facts.

export type HeadTone = "good" | "bad" | "neutral";

export interface Headline {
  big: string;
  rest: string | null;
  tone: HeadTone;
}

export interface Fact {
  label: string;
  value: string;
  /** A coloured dot before the value: only for a day outside its usual range. */
  dot?: "good" | "bad";
}

const tone = (t: string): HeadTone => (t === "good" || t === "bad" ? t : "neutral");

/** A short span of days: "6 to 7 Nov" within a month, "30 Oct to 2 Nov" across one, "4 Nov" for one day. */
export function daySpan(from: Day, to: Day, day: Day): string {
  if (from === to) return dayLabel(from, day);
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  return `${sameMonth ? Number(from.slice(8)) : dayLabel(from, day)} to ${dayLabel(to, day)}`;
}

const dayBefore = (day: Day) => format(subDays(parseISO(day), 1), "yyyy-MM-dd");

// Mistake

/** "89% fewer than before the rule" in its colour; for a mistake with no rule, its rate now. */
export function mistakeHeadline(mistake: Mistake): Headline {
  if (!mistake.rule) {
    return mistake.current
      ? { big: `${percent(mistake.current.rate)} of tasks`, rest: "no rule yet", tone: "neutral" }
      : { big: "No tasks", rest: "in the last 4 weeks", tone: "neutral" };
  }
  const words = changeWords(mistake.change, "plain", missingMistakeChange(mistake));
  if (!words.hasRange) return { big: words.lead, rest: null, tone: "neutral" };
  return {
    big: words.lead,
    rest: words.tone === "unclear" ? "against before the rule" : "than before the rule",
    tone: tone(words.tone),
  };
}

/** What the mistake's chart compares, in one line. */
export function mistakeLine(mistake: Mistake, day: Day): string {
  return mistake.rule
    ? `How often this mistake happened, before and since the rule changed on ${dayLabel(mistake.rule.day, day)}.`
    : "How often this mistake happened over the last 4 weeks; no rule targets it yet.";
}

/** Before, since, today, the rule's wording and, when it applies, a small-sample note. */
export function mistakeFacts(mistake: Mistake, day: Day): Fact[] {
  const facts: Fact[] = [];
  const { rule, before, after, current, today } = mistake;
  if (rule) {
    facts.push({
      label: "Before the rule",
      value: before
        ? `${percent(before.rate)} (${plural(before.tasks, "task")}, ${daySpan(before.from, dayBefore(rule.day), day)})`
        : "no tasks",
    });
    facts.push({
      label: "Since the rule",
      value: after
        ? `${percent(after.rate)} (${plural(after.tasks, "task")}, from ${dayLabel(rule.day, day)})`
        : "no tasks",
    });
  } else if (current) {
    facts.push({ label: "Tasks", value: `${number(current.tasks)} since ${dayLabel(current.from, day)}` });
  }
  if (today) {
    facts.push({
      label: "Today",
      value: `${percent(today.rate)}, usually ${percent(today.usual_low)} to ${percent(today.usual_high)}`,
      ...(today.outside && { dot: today.outside === "above" ? ("bad" as const) : ("good" as const) }),
    });
  }
  if (rule) facts.push({ label: "Rule", value: rule.what });
  const note = fewTasksNote(mistake);
  if (note) facts.push({ label: "Note", value: note });
  return facts;
}

// Trial

/** Where a trial is: when it starts, its day and its result so far, or its verdict. */
export function trialHeadline(trial: Trial, day: Day): Headline {
  if (trial.state === "scheduled")
    return { big: `Starts ${dayLabel(trial.started, day)}`, rest: null, tone: "neutral" };
  const words = changeWords(trial.change);
  const sofar = words.hasRange ? `${words.lead.toLowerCase()} so far` : "too early to tell";
  if (trial.state === "running") {
    const { n, of } = trialDay(trial, day);
    return { big: `Day ${n} of ${of}`, rest: sofar, tone: "neutral" };
  }
  return { big: verdictWords(trial.verdict), rest: null, tone: tone(trialBadge(trial).tone) };
}

/** What a trial is, in one line. */
export function trialLine(trial: Trial): string {
  const days = differenceInCalendarDays(parseISO(trial.ends), parseISO(trial.started));
  return `Half of tasks run with the rule and half without, for ${days} days.`;
}

/** The tasks needed each way, as the progress chart's caption says it. */
export function neededEachWay(trial: Trial): string {
  return trial.needed === null ? "over 320 needed each way" : `about ${number(trial.needed)} needed each way`;
}

/** Start, end, usual pace and, while it can still miss, the outlook. */
export function trialFacts(trial: Trial, day: Day): Fact[] {
  const facts: Fact[] = [
    { label: "Starts", value: dayLabel(trial.started, day) },
    { label: "Ends", value: dayLabel(trial.ends, day) },
    { label: "Usual pace", value: `about ${number(trial.per_week)} tasks each way per week` },
  ];
  const short = trial.per_week < (trial.needed ?? Number.POSITIVE_INFINITY);
  if (trial.state !== "finished" && short) {
    facts.push({
      label: "Outlook",
      value: `May end unclear: needs ${trial.needed === null ? "over 320" : `about ${number(trial.needed)}`}`,
    });
  }
  return facts;
}

// Proven rule

export function permanentHeadline(check: PermanentCheck): Headline {
  const status = permanentStatus(check);
  return {
    big: STATUS_WORDS[status],
    rest: null,
    tone: tone(status === "working" ? "good" : status === "slipping" ? "bad" : ""),
  };
}

export const PERMANENT_LINE = "1 task in 10 runs without this rule, to check it still earns its place.";

export function permanentFacts(check: PermanentCheck, day: Day): Fact[] {
  return [
    { label: "Checked since", value: dayLabel(check.since, day) },
    { label: "Tasks without the rule", value: number(check.tasks_without) },
    { label: "Tasks with the rule", value: number(check.tasks_with) },
    ...(check.model ? [{ label: "Model", value: check.model }] : []),
  ];
}

// Replay

/** A trusted replay's verdict; an untrusted one says only that, with nothing bold to contradict it. */
export function replayHeadline(replay: Replay): Headline & { outlined: boolean } {
  if (!replay.trusted) return { big: "Can't be trusted", rest: null, tone: "bad", outlined: true };
  return {
    big: verdictWords(replay.verdict),
    rest: null,
    tone: replay.verdict === "works" ? "good" : "neutral",
    outlined: false,
  };
}

export const REPLAY_LINE = "Past moments answered again under the old and the new wording of the rule.";

export const UNRELIABLE = "Not reliable: the replay did not behave like real agents";

/** An untrusted replay's change, said as muted words about the replay only: "72% fewer in the replay". */
export function replayChangeAside(replay: Replay): string | null {
  const words = changeWords(replay.change);
  return words.hasRange && words.tone !== "unclear" ? `${words.lead} in the replay` : null;
}

export function replayFacts(replay: Replay, day: Day): Fact[] {
  return [
    {
      label: "Check",
      value:
        replay.real_rate === null || replay.replay_rate === null
          ? "No real rate to compare with"
          : `Real agents ${percent(replay.real_rate)} · replay ${percent(replay.replay_rate)} under the same rules`,
    },
    { label: "Replayed", value: dayLabel(replay.day, day) },
    { label: "Past moments", value: number(replay.moments) },
    { label: "Paired", value: number(replay.paired) },
  ];
}

// Rule size

type Series = Sizes["series"][number];

/** "1,804 words, up from 769 on 14 Oct": the words now against the first day's. */
export function sizeHeadline(series: Series, day: Day): Headline {
  const first = series.points[0];
  const big = `${number(series.now)} words`;
  if (!first) return { big, rest: null, tone: "neutral" };
  const how = series.now > first.words ? "up from" : series.now < first.words ? "down from" : "same as";
  return { big, rest: `${how} ${number(first.words)} on ${dayLabel(first.day, day)}`, tone: "neutral" };
}

export const SIZE_LINE: Record<Series["label"], string> = {
  Rules: "The rule files an agent reads on every turn. Shorter is better.",
  Skills: "The skill files an agent reads when it loads a skill. Shorter is better.",
};

/** One month of edits: "Oct · 33% · 7 of 21", the share of edits that only added words. */
export function onlyAddedLine(month: Sizes["months"][number], day: Day): string {
  const count = Math.round(month.only_added * month.changes);
  return `${monthLabel(month.month, day)} · ${percent(month.only_added)} · ${count} of ${number(month.changes)}`;
}
