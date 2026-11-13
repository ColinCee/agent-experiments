// A made-up report about a fictional team's agents, for the dev server and tests. It covers every state the page shows.
import { addDays, format, parseISO } from "date-fns";
import type { Day, Mistake, MistakeChange, Range, Report, Side } from "./report";

const DAY = "2026-11-12";
const SERIES_DAYS = 42;

const shift = (day: Day, n: number): Day => format(addDays(parseISO(day), n), "yyyy-MM-dd");
const seriesStart = shift(DAY, 1 - SERIES_DAYS);
const round = (x: number) => Math.round(x * 1000) / 1000;

/** A small seeded generator (mulberry32), so the made-up series are noisy but the same on every run. */
function random(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 2 ** 32;
  };
}

/**
 * A noisy daily rate around `before`, stepping to `after` on `ruleDay`: a random walk that drifts back to its level,
 * with about one day in twelve missing. Days in `keep` (where markers sit) always have data. Before `earlier.until`
 * the level is `earlier.rate` instead.
 */
function series(
  before: number,
  after: number,
  ruleDay: Day | null,
  seed: number,
  keep: Day[] = [],
  earlier?: { until: Day; rate: number },
) {
  const next = random(seed);
  let walk = 0;
  return Array.from({ length: SERIES_DAYS }, (_, i) => {
    const day = shift(seriesStart, i);
    const base = ruleDay !== null && day >= ruleDay ? after : earlier && day < earlier.until ? earlier.rate : before;
    walk = 0.7 * walk + (next() - 0.5) * 0.6;
    const gap = next() < 1 / 12 && !keep.includes(day);
    return { day, rate: gap ? null : round(Math.min(1, base * Math.exp(walk))) };
  });
}

const side = (rate: number, low: number | null, high: number | null, tasks: number, from: Day): Side => ({
  rate,
  low,
  high,
  tasks,
  from,
});

function withRule(
  name: string,
  rule: { day: Day; what: string },
  earlier: MistakeChange[],
  before: Side,
  after: Side,
  range: { low: number | null; high: number | null } | null,
  today: Mistake["today"],
  phase: number,
  earlierRate?: number,
): Mistake {
  const change: Range | null = range && { value: round(after.rate / before.rate - 1), ...range };
  const sure = change?.low != null && change.high != null && change.low * change.high > 0;
  return {
    name,
    today,
    rule,
    before,
    after,
    change,
    sure,
    current: null,
    series: series(
      before.rate,
      after.rate,
      rule.day,
      phase * 1000,
      [...earlier, rule].map((c) => c.day),
      earlierRate === undefined ? undefined : { until: before.from, rate: earlierRate },
    ),
    changes: [...earlier, { ...rule, kind: "rule" as const }].filter((c) => c.day >= seriesStart),
  };
}

function noRule(
  name: string,
  current: Side,
  today: Mistake["today"],
  phase: number,
  changes: MistakeChange[] = [],
): Mistake {
  return {
    name,
    today,
    rule: null,
    before: null,
    after: null,
    change: null,
    sure: false,
    current,
    series: series(
      current.rate,
      current.rate,
      null,
      phase * 1000,
      changes.map((c) => c.day),
    ),
    changes,
  };
}

const usual = (rate: number, usual_low: number, usual_high: number): Mistake["today"] => ({
  rate,
  usual_low,
  usual_high,
  outside: rate > usual_high ? "above" : rate < usual_low ? "below" : null,
});

const usualStart = shift(DAY, -27);

const mistakes: Mistake[] = [
  withRule(
    "Replies with no summary line",
    { day: "2026-10-20", what: "Replies end with one line saying what is left" },
    [{ day: "2026-10-08", what: "Replies open with the answer", kind: "rule" }],
    side(0.32, 0.27, 0.38, 140, "2026-10-08"),
    side(0.12, 0.08, 0.17, 110, "2026-10-20"),
    { low: -0.78, high: -0.45 },
    usual(0.1, 0.06, 0.18),
    0,
  ),
  withRule(
    "Tests skipped before a commit",
    { day: "2026-11-07", what: "Run the checks before every commit" },
    [{ day: "2026-11-01", what: "Tests skipped before a commit", kind: "trial" }],
    side(0.25, 0.2, 0.3, 180, "2026-11-01"),
    side(0.1, 0.07, 0.14, 60, "2026-11-07"),
    { low: -0.74, high: -0.42 },
    usual(0.31, 0.04, 0.17),
    1.1,
  ),
  withRule(
    "Branch pushed without a pull request",
    { day: "2026-10-15", what: "Every change goes through a pull request" },
    [],
    // Since the rule this mistake has not happened once: a since rate of 0%.
    side(0.18, 0.14, 0.23, 200, seriesStart),
    side(0, 0, 0.02, 170, "2026-10-15"),
    { low: -1, high: -0.88 },
    usual(0.01, 0.03, 0.11),
    2.3,
  ),
  withRule(
    "Long logs pasted into a reply",
    { day: "2026-10-28", what: "Quote the failing lines, link the rest" },
    [{ day: "2026-10-28", what: "Long logs pasted into a reply", kind: "trial" }],
    side(0.4, 0.33, 0.47, 120, seriesStart),
    side(0.22, 0.16, 0.29, 90, "2026-10-28"),
    { low: -0.63, high: -0.24 },
    usual(0.2, 0.12, 0.34),
    3.7,
  ),
  withRule(
    "Questions asked that the notes answer",
    { day: "2026-09-20", what: "Search the team notes before asking" },
    [],
    side(0.15, 0.11, 0.2, 130, "2026-08-09"),
    side(0.15, 0.1, 0.2, 115, "2026-09-20"),
    { low: -0.38, high: 0.25 },
    usual(0.14, 0.07, 0.22),
    0.6,
  ),
  withRule(
    "Ports taken without checking",
    { day: "2026-10-22", what: "Check a port is free before using it" },
    [],
    side(0.06, 0.03, 0.1, 90, seriesStart),
    side(0.14, 0.09, 0.2, 80, "2026-10-22"),
    { low: 0.2, high: 2.1 },
    null,
    4.4,
  ),
  withRule(
    "Release notes left unwritten",
    { day: "2026-11-06", what: "Write the release note with the change" },
    [{ day: "2026-11-03", what: "Name the release in the note", kind: "rule" }],
    // Every one of the few tasks before the rule had the mistake: a before rate of 100%.
    side(1, null, null, 6, "2026-11-03"),
    side(0.333, null, null, 3, "2026-11-06"),
    { low: null, high: null },
    usual(0.33, 0.2, 0.6),
    5.2,
    // The before window is the 3 days after the earlier change; the weeks before it ran far lower.
    0.12,
  ),
  noRule("Config read from memory", side(0.18, 0.13, 0.24, 150, usualStart), usual(0.08, 0.03, 0.15), 2.9, [
    { day: shift(DAY, -3), what: "Config read from memory", kind: "trial" },
  ]),
  noRule("Screenshots sent without a link", side(0.21, 0.16, 0.27, 160, usualStart), usual(0.2, 0.12, 0.3), 1.8),
  noRule("Old branches left open", side(0.27, 0.2, 0.35, 95, usualStart), null, 0.3, [
    { day: DAY, what: "Old branches left open", kind: "trial" },
  ]),
].sort((a, b) => a.name.localeCompare(b.name));

const sizePoints = (first: number, last: number) =>
  Array.from({ length: 20 }, (_, i) => ({
    day: shift("2026-10-05", i * 2),
    words: Math.max(0, Math.round(first + ((last - first) * i) / 19 + (i % 3 === 1 ? -40 : 0))),
  }));

const ruleWords = sizePoints(3200, 4100);
// Skills start from nothing, as a new file set does.
const skillWords = sizePoints(0, 12600);

export const fixture: Report = {
  day: DAY,
  written: "2026-11-13T06:00:00Z",
  sessions: { total: 48, in_group: 24, split_since: "2026-10-01" },
  trials: [
    {
      name: "Screenshots sent without a link",
      started: shift(DAY, 1),
      ends: shift(DAY, 8),
      state: "scheduled",
      verdict: null,
      tasks_with: 0,
      tasks_without: 0,
      rate_with: null,
      rate_without: null,
      change: null,
      needed: 140,
      per_week: 60,
      looks: [],
      trend: [],
    },
    {
      name: "Config read from memory",
      started: shift(DAY, -3),
      ends: shift(DAY, 4),
      state: "running",
      verdict: "no verdict yet",
      tasks_with: 34,
      tasks_without: 31,
      rate_with: 0.088,
      rate_without: 0.194,
      change: { value: -0.546, low: -0.85, high: 0.3 },
      needed: 120,
      per_week: 55,
      looks: [{ look: 1, day: DAY, verdict: "no verdict yet", tasks_with: 34, tasks_without: 31 }],
      trend: [
        { day: shift(DAY, -3), with: null, without: 0.2 },
        { day: shift(DAY, -2), with: 0.11, without: 0.21 },
        { day: shift(DAY, -1), with: 0.09, without: 0.18 },
        { day: DAY, with: 0.088, without: 0.194 },
      ],
    },
    {
      name: "Tests skipped before a commit",
      started: "2026-11-01",
      ends: "2026-11-08",
      state: "finished",
      verdict: "works",
      tasks_with: 70,
      tasks_without: 66,
      rate_with: 0.1,
      rate_without: 0.25,
      change: { value: -0.6, low: -0.78, high: -0.33 },
      needed: 90,
      per_week: 65,
      looks: [
        { look: 1, day: "2026-11-04", verdict: "no verdict yet", tasks_with: 31, tasks_without: 29 },
        { look: 2, day: "2026-11-06", verdict: "works", tasks_with: 70, tasks_without: 66 },
      ],
      trend: Array.from({ length: 6 }, (_, i) => ({
        day: shift("2026-11-01", i),
        with: i === 0 ? null : round(0.13 - i * 0.005),
        without: round(0.23 + (i % 2) * 0.03),
      })),
    },
  ],
  permanent: [
    {
      name: "Replies with no summary line",
      since: "2026-10-30",
      model: "model-a",
      tasks_with: 140,
      tasks_without: 15,
      change: { value: -0.55, low: -0.8, high: -0.1 },
      slipping: false,
    },
    {
      name: "Branch pushed without a pull request",
      since: DAY,
      model: "model-a",
      tasks_with: 3,
      tasks_without: 0,
      change: null,
      slipping: false,
    },
    {
      name: "Questions asked that the notes answer",
      since: "2026-11-05",
      model: "model-a",
      tasks_with: 40,
      tasks_without: 3,
      change: { value: -0.3, low: -0.9, high: 0.8 },
      slipping: false,
    },
    {
      name: "Long logs pasted into a reply",
      since: "2026-10-30",
      model: "model-a",
      tasks_with: 150,
      tasks_without: 16,
      change: { value: -0.4, low: -0.7, high: 0.15 },
      slipping: false,
    },
    {
      name: "Old branches left open",
      since: "2026-10-30",
      model: "model-a",
      tasks_with: 90,
      tasks_without: 11,
      change: null,
      slipping: false,
    },
    {
      name: "Drafts saved in the wrong folder",
      since: "2026-09-20",
      model: "model-a",
      tasks_with: 300,
      tasks_without: 33,
      change: { value: 0.05, low: -0.2, high: 0.4 },
      slipping: true,
    },
  ],
  mistakes,
  replays: [
    {
      name: "Replies with no summary line",
      day: "2026-11-10",
      verdict: "works",
      trusted: true,
      real_rate: 0.3,
      replay_rate: 0.28,
      rate_old: 0.29,
      rate_new: 0.11,
      moments: 40,
      paired: 38,
      change: { value: -0.621, low: -0.8, high: -0.4 },
    },
    {
      name: "Questions asked that the notes answer",
      day: "2026-11-11",
      verdict: "can't tell",
      trusted: true,
      real_rate: 0.15,
      replay_rate: 0.17,
      rate_old: 0.16,
      rate_new: 0.14,
      moments: 30,
      paired: 27,
      change: { value: -0.125, low: -0.45, high: 0.3 },
    },
    {
      name: "Ports taken without checking",
      day: DAY,
      verdict: "no useful effect",
      trusted: false,
      real_rate: 0.1,
      replay_rate: 0.4,
      rate_old: 0.4,
      rate_new: 0.38,
      moments: 20,
      paired: 12,
      change: { value: -0.05, low: -0.3, high: 0.25 },
    },
    {
      name: "Old branches left open",
      day: DAY,
      verdict: "replay can't test this",
      trusted: false,
      real_rate: null,
      replay_rate: null,
      rate_old: null,
      rate_new: null,
      moments: 8,
      paired: 0,
      change: null,
    },
  ],
  sizes: {
    series: [
      {
        label: "Rules",
        now: ruleWords[19].words,
        points: ruleWords,
      },
      { label: "Skills", now: skillWords[19].words, points: skillWords },
    ],
    largest: [
      { file: "skills/release-checklist/SKILL.md", words: 2100 },
      { file: "rules/team.md", words: 1850 },
      { file: "skills/code-review/SKILL.md", words: 1620 },
      { file: "skills/incident-notes/SKILL.md", words: 1400 },
      { file: "rules/replies.md", words: 1210 },
      { file: "skills/data-export/SKILL.md", words: 980 },
      { file: "rules/branches.md", words: 760 },
      { file: "skills/screenshots/SKILL.md", words: 540 },
    ],
    months: [
      { month: "2026-10", label: "Rules", changes: 14, only_added: 0.643, added_share: 0.71 },
      { month: "2026-10", label: "Skills", changes: 22, only_added: 0.773, added_share: 0.86 },
      { month: "2026-11", label: "Rules", changes: 5, only_added: 0.4, added_share: 0.52 },
      { month: "2026-11", label: "Skills", changes: 8, only_added: 0.75, added_share: 0.8 },
    ],
  },
};

const noData = series(0, 0, null, 0).map(({ day }) => ({ day, rate: null }));

/** A report with nothing in it yet: no trials, permanent rules or replays, and mistakes without any data. */
export const emptyReport: Report = {
  day: DAY,
  written: "2026-11-13T06:00:00Z",
  sessions: { total: 0, in_group: 0, split_since: null },
  trials: [],
  permanent: [],
  mistakes: [
    {
      name: "Replies with no summary line",
      today: null,
      rule: { day: "2026-11-01", what: "Replies end with one line saying what is left" },
      before: null,
      after: null,
      change: null,
      sure: false,
      current: null,
      series: noData,
      changes: [{ day: "2026-11-01", what: "Replies end with one line saying what is left", kind: "rule" }],
    },
    {
      name: "Screenshots sent without a link",
      today: null,
      rule: null,
      before: null,
      after: null,
      change: null,
      sure: false,
      current: null,
      series: noData,
      changes: [],
    },
  ],
  replays: [],
  sizes: { series: [], largest: [], months: [] },
};
