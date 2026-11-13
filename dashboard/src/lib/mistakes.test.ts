import { expect, test } from "vitest";
import type { Mistake, Range } from "@/data/report";
import {
  changesByDay,
  fewTasksNote,
  historyBands,
  historyRows,
  markerLabel,
  markerWords,
  missingMistakeChange,
  scoreWords,
  slug,
  sortByChange,
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

test("a mistake's small samples are said once, and nothing when both sides have enough", () => {
  const side = (tasks: number) => ({ rate: 0.1, low: null, high: null, tasks, from: "2026-11-02" });
  expect(fewTasksNote(mistake({ before: side(7), after: side(3) }))).toBe("only 7 tasks before and 3 after the rule");
  expect(fewTasksNote(mistake({ before: side(40), after: side(30) }))).toBeNull();
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

test("history bands shade the before window grey and since the rule blue, held inside the series", () => {
  const series = ["2026-11-01", "2026-11-05", "2026-11-12"].map((day) => ({ day, rate: 0.1 }));
  const side = (from: string) => ({ rate: 0.1, low: null, high: null, tasks: 30, from });
  const rule = { day: "2026-11-05", what: "Do it" };
  expect(historyBands(mistake({ series, rule, before: side("2026-11-03") }))).toEqual([
    { kind: "before", from: "2026-11-03", to: "2026-11-05" },
    { kind: "after", from: "2026-11-05", to: "2026-11-12" },
  ]);
  expect(historyBands(mistake({ series, rule, before: side("2026-10-01") }))[0].from).toBe("2026-11-01");
  expect(
    historyBands(mistake({ series, rule: { day: "2026-09-01", what: "Old" }, before: side("2026-08-01") })),
  ).toEqual([{ kind: "after", from: "2026-11-01", to: "2026-11-12" }]);
  expect(historyBands(mistake({ series, rule: null, current: side("2026-11-05") }))).toEqual([
    { kind: "before", from: "2026-11-05", to: "2026-11-12" },
  ]);
});

test("the scorecard says the change in short words, or a short reason", () => {
  const side = (tasks: number) => ({ rate: 0.1, low: null, high: null, tasks, from: "2026-10-01" });
  const m = (change: Mistake["change"], before = 30, after = 30) =>
    mistake({ change, before: side(before), after: side(after) });
  expect(scoreWords(m({ value: -0.79, low: -0.9, high: -0.6 }))).toMatchObject({ lead: "79% fewer", tone: "good" });
  expect(scoreWords(m(null)).lead).toBe("Nothing to compare");
  expect(scoreWords(m(null, 3, 30)).lead).toBe("Too few tasks");
  expect(scoreWords(m({ value: -0.4, low: null, high: null })).lead).toBe("Too few tasks");
});

test("a marker's tip names what changed; its label says what it is, and a window's opening rule has none", () => {
  expect(markerWords({ day: "2026-10-01", what: "Do it", kind: "rule" }, "2026-11-12")).toBe(
    "Rule changed 1 Oct: Do it",
  );
  expect(markerWords({ day: "2026-11-09", what: "A trial", kind: "trial" }, "2026-11-12")).toBe("Trial began 9 Nov");
  const before = { rate: 0.3, low: null, high: null, tasks: 20, from: "2026-11-02" };
  const m = mistake({ rule: { day: "2026-11-08", what: "Do it right" }, before });
  const rule = (day: string) => ({ day, what: "x", kind: "rule" as const });
  const trial = (day: string) => ({ day, what: "x", kind: "trial" as const });
  expect(markerLabel([rule("2026-11-08")], m, "2026-11-12")).toBe("Rule changed 8 Nov");
  expect(markerLabel([trial("2026-11-06")], m, "2026-11-12")).toBe("Trial began 6 Nov");
  expect(markerLabel([trial("2026-11-08"), rule("2026-11-08")], m, "2026-11-12")).toBe("Rule changed 8 Nov");
  expect(markerLabel([rule("2026-11-02")], m, "2026-11-12")).toBeNull();
  expect(markerLabel([trial("2026-11-02")], m, "2026-11-12")).toBe("Trial began 2 Nov");
});
