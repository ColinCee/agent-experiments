import { expect, test } from "vitest";
import type { Mistake, Range } from "@/data/report";
import {
  changesByDay,
  currentWords,
  historyRows,
  markerWords,
  missingMistakeChange,
  overviewHint,
  ruleSince,
  ruleTasks,
  slug,
  sortByChange,
  todayChip,
} from "./mistakes";

const mistake = (over: Partial<Mistake>): Mistake => ({
  name: "A mistake",
  today: null,
  rule: { day: "2026-11-08", what: "Do it right" },
  before: null,
  after: null,
  change: null,
  sure: false,
  current: null,
  series: [],
  changes: [],
  ...over,
});

const range = (value: number, low: number | null, high: number | null): Range => ({ value, low, high });

test("rules sort clearly fewer (largest first), then unclear, then clearly more", () => {
  const sorted = sortByChange([
    mistake({ name: "more", change: range(0.5, 0.1, 0.9) }),
    mistake({ name: "unclear", change: range(-0.2, -0.5, 0.2) }),
    mistake({ name: "few tasks", change: null }),
    mistake({ name: "a bit fewer", change: range(-0.3, -0.5, -0.1) }),
    mistake({ name: "much fewer", change: range(-0.8, -0.9, -0.6) }),
  ]);
  expect(sorted.map((m) => m.name)).toEqual(["much fewer", "a bit fewer", "unclear", "few tasks", "more"]);
});

test("under the chart only the latest rule is named; a marker names a rule or a trial's start", () => {
  const m = mistake({ rule: { day: "2026-11-08", what: "Do it right" } });
  expect(ruleSince(m, "2026-11-12")).toBe("Rule since 8 Nov: Do it right");
  expect(ruleSince(mistake({ rule: null }), "2026-11-12")).toBeNull();
  expect(markerWords({ day: "2026-10-01", what: "Do it", kind: "rule" }, "2026-11-12")).toBe(
    "Rule changed 1 Oct: Do it",
  );
  expect(markerWords({ day: "2026-11-09", what: "A trial", kind: "trial" }, "2026-11-12")).toBe("Trial started 9 Nov");
});

test("the today chip shows only outside the usual range", () => {
  const today = (outside: "above" | "below" | null) => ({ rate: 0.2, usual_low: 0.1, usual_high: 0.3, outside });
  expect(todayChip(mistake({ today: today("above") }))).toEqual({
    text: "Above usual today: 20%, usually 10% to 30%",
    tone: "bad",
  });
  expect(todayChip(mistake({ today: today("below") }))).toEqual({
    text: "Below usual today: 20%, usually 10% to 30%",
    tone: "good",
  });
  expect(todayChip(mistake({ today: today(null) }))).toBeNull();
  expect(todayChip(mistake({ today: null }))).toBeNull();
});

test("the task line names the windows the before and since rates cover", () => {
  const side = { rate: 0.1, low: null, high: null, tasks: 14, from: "2026-11-02" };
  const rule = { day: "2026-11-05", what: "Do it" };
  expect(ruleTasks(mistake({ rule, before: side, after: { ...side, tasks: 82 } }), "2026-11-12")).toBe(
    "14 tasks 2 Nov to 4 Nov · 82 since 5 Nov",
  );
  expect(ruleTasks(mistake({ rule, before: { ...side, tasks: 1, from: "2026-11-04" } }), "2026-11-12")).toBe(
    "1 task on 4 Nov · 0 since 5 Nov",
  );
  expect(ruleTasks(mistake({ rule, after: side }), "2026-11-12")).toBe("No tasks before the rule · 14 since 5 Nov");
});

test("the overview hint names a short before window, with the small-sample words when both fit", () => {
  const side = (tasks: number, from: string) => ({ rate: 0.1, low: null, high: null, tasks, from });
  const rule = { day: "2026-11-05", what: "Do it" };
  const hint = (before: number, from: string, after: number) =>
    overviewHint(mistake({ rule, before: side(before, from), after: side(after, rule.day) }), "2026-11-12");
  expect(hint(40, "2026-11-02", 30)).toBe("before = 2 Nov to 4 Nov");
  expect(hint(40, "2026-11-04", 30)).toBe("before = 4 Nov");
  expect(hint(40, "2026-10-01", 30)).toBeNull();
  expect(hint(40, "2026-10-01", 3)).toBe("only 3 tasks since the rule");
  expect(hint(6, "2026-11-02", 30)).toBe("only 6 tasks before · before = 2 Nov to 4 Nov");
  expect(hint(6, "2026-11-02", 3)).toBe("only 6 tasks before and 3 since the rule");
});

test("a mistake with no rule reads its rate now and since when", () => {
  const current = { rate: 0.33, low: 0.25, high: 0.41, tasks: 96, from: "2026-10-27" };
  expect(currentWords(mistake({ rule: null, current }), "2026-11-12")).toEqual({
    rate: "33% now",
    tasks: "96 tasks since 27 Oct",
  });
  expect(currentWords(mistake({ rule: null }), "2026-11-12")).toBeNull();
});

test("history rows are earlier history, the before window, then since the rule, sharing boundary days", () => {
  const series = [
    { day: "2026-11-05", rate: 0.9 },
    { day: "2026-11-06", rate: 0.3 },
    { day: "2026-11-07", rate: 0.2 },
    { day: "2026-11-08", rate: 0.25 },
    { day: "2026-11-09", rate: null },
    { day: "2026-11-10", rate: 0.1 },
  ];
  const before = { rate: 0.25, low: null, high: null, tasks: 30, from: "2026-11-06" };
  expect(historyRows(mistake({ series, before }))).toEqual([
    { day: "2026-11-05", earlier: 0.9, before: null, after: null },
    { day: "2026-11-06", earlier: 0.3, before: 0.3, after: null },
    { day: "2026-11-07", earlier: null, before: 0.2, after: null },
    { day: "2026-11-08", earlier: null, before: 0.25, after: 0.25 },
    { day: "2026-11-09", earlier: null, before: null, after: null },
    { day: "2026-11-10", earlier: null, before: null, after: 0.1 },
  ]);
});

test("with no compared window all history before the rule is earlier; with no rule grey starts at the rate now", () => {
  const series = [
    { day: "2026-11-07", rate: 0.3 },
    { day: "2026-11-08", rate: 0.2 },
  ];
  expect(historyRows(mistake({ series })).map((r) => [r.earlier, r.before])).toEqual([
    [0.3, null],
    [0.2, null],
  ]);
  const current = { rate: 0.2, low: null, high: null, tasks: 30, from: "2026-11-08" };
  expect(historyRows(mistake({ rule: null, current, series })).map((r) => [r.earlier, r.before, r.after])).toEqual([
    [0.3, null, null],
    [0.2, 0.2, null],
  ]);
});

test("slugs are lower-case words joined by dashes", () => {
  expect(slug("Tests skipped, before a commit!")).toBe("tests-skipped-before-a-commit");
});

test("changes on the same day share one marker, in order", () => {
  const groups = changesByDay([
    { day: "2026-11-02", what: "A", kind: "rule" },
    { day: "2026-11-07", what: "B", kind: "rule" },
    { day: "2026-11-07", what: "C", kind: "trial" },
  ]);
  expect(groups.map((g) => [g.day, g.changes.map((c) => c.what)])).toEqual([
    ["2026-11-02", ["A"]],
    ["2026-11-07", ["B", "C"]],
  ]);
});

test("a mistake's missing change says no mistakes before the rule only when both sides have tasks enough", () => {
  const side = { rate: 0, low: null, high: null, tasks: 30, from: "2026-10-01" };
  expect(missingMistakeChange(mistake({ before: side, after: side }))).toBe(
    "No mistakes before the rule, so nothing to compare",
  );
  expect(missingMistakeChange(mistake({ before: side, after: { ...side, tasks: 2 } }))).toBe("Too few tasks to tell");
  expect(missingMistakeChange(mistake({ before: null, after: side }))).toBe("Too few tasks to tell");
});
