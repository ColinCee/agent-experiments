import { expect, test } from "vitest";
import type { Mistake, Range } from "@/data/report";
import {
  currentWords,
  historyRows,
  markerWords,
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
  expect(todayChip(mistake({ today: today("above") }))).toEqual({ text: "Above usual today", tone: "bad" });
  expect(todayChip(mistake({ today: today("below") }))).toEqual({ text: "Below usual today", tone: "good" });
  expect(todayChip(mistake({ today: today(null) }))).toBeNull();
  expect(todayChip(mistake({ today: null }))).toBeNull();
});

test("tasks before and since a rule count missing sides as none", () => {
  const side = { rate: 0.1, low: null, high: null, tasks: 79, from: "2026-10-01" };
  expect(ruleTasks(mistake({ before: { ...side, tasks: 64 }, after: { ...side, tasks: 88 } }))).toBe(
    "64 tasks before · 88 since",
  );
  expect(ruleTasks(mistake({ before: { ...side, tasks: 1 } }))).toBe("1 task before · 0 since");
});

test("a mistake with no rule reads its rate now and since when", () => {
  const current = { rate: 0.33, low: 0.25, high: 0.41, tasks: 96, from: "2026-10-27" };
  expect(currentWords(mistake({ rule: null, current }), "2026-11-12")).toEqual({
    rate: "33% now",
    tasks: "96 tasks since 27 Oct",
  });
  expect(currentWords(mistake({ rule: null }), "2026-11-12")).toBeNull();
});

test("history rows split at the latest rule change, sharing its day, and keep gaps", () => {
  const series = [
    { day: "2026-11-07", rate: 0.3 },
    { day: "2026-11-08", rate: 0.2 },
    { day: "2026-11-09", rate: null },
    { day: "2026-11-10", rate: 0.1 },
  ];
  expect(historyRows(mistake({ series }))).toEqual([
    { day: "2026-11-07", before: 0.3, after: null },
    { day: "2026-11-08", before: 0.2, after: 0.2 },
    { day: "2026-11-09", before: null, after: null },
    { day: "2026-11-10", before: null, after: 0.1 },
  ]);
  expect(historyRows(mistake({ rule: null, series })).map((r) => r.after)).toEqual([null, null, null, null]);
});

test("slugs are lower-case words joined by dashes", () => {
  expect(slug("Tests skipped, before a commit!")).toBe("tests-skipped-before-a-commit");
});
