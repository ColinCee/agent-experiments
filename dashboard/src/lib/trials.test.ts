import { describe, expect, test } from "vitest";
import type { Trial } from "@/data/report";
import {
  missingTrialChange,
  neededWords,
  sortTrials,
  taskScale,
  tasksNote,
  trendRows,
  trialBadge,
  trialDay,
  trialSummary,
  trialWhen,
  verdictWords,
} from "./trials";

const trial = (over: Partial<Trial>): Trial => ({
  name: "A trial",
  started: "2026-11-09",
  ends: "2026-11-16",
  state: "running",
  verdict: null,
  tasks_with: 14,
  tasks_without: 9,
  rate_with: 0.1,
  rate_without: 0.2,
  change: null,
  needed: 70,
  per_week: 90,
  looks: [],
  trend: [],
  ...over,
});

describe("trialDay", () => {
  test("counts the start as day 1 of 7", () => {
    expect(trialDay(trial({}), "2026-11-09")).toEqual({ n: 1, of: 7 });
    expect(trialDay(trial({}), "2026-11-12")).toEqual({ n: 4, of: 7 });
  });

  test("the last look's day still reads as the last day", () => {
    expect(trialDay(trial({}), "2026-11-16")).toEqual({ n: 7, of: 7 });
  });
});

describe("trialWhen", () => {
  test("a scheduled trial says when it starts", () => {
    expect(trialWhen(trial({ state: "scheduled", started: "2026-11-13" }), "2026-11-12", true)).toBe("Starts 13 Nov");
  });

  test("a running trial says its day, and when it ends in full", () => {
    expect(trialWhen(trial({}), "2026-11-12", true)).toBe("Day 4 of 7 · ends 16 Nov");
    expect(trialWhen(trial({}), "2026-11-12", false)).toBe("Day 4 of 7");
  });

  test("a finished trial says the day of its last look", () => {
    const looks = [{ look: 2, day: "2026-11-11", verdict: "works" as const, tasks_with: 40, tasks_without: 40 }];
    expect(trialWhen(trial({ state: "finished", looks }), "2026-11-12", true)).toBe("Finished 11 Nov");
  });
});

test("verdicts read as plain words, never the word effect", () => {
  expect(verdictWords("works")).toBe("Works");
  expect(verdictWords("no useful effect")).toBe("No useful change");
  expect(verdictWords("can't tell")).toBe("Can't tell");
  expect(verdictWords("no verdict yet")).toBe("Too early");
  expect(verdictWords(null)).toBe("Too early");
});

describe("tasksNote", () => {
  test("warns when a week brings fewer tasks than needed", () => {
    expect(tasksNote(trial({ per_week: 23 }))).toBe(
      "A week usually brings about 23 per half, so this trial may end unclear.",
    );
  });

  test("says nothing when a week brings enough, or the trial is over", () => {
    expect(tasksNote(trial({ per_week: 90 }))).toBeNull();
    expect(tasksNote(trial({ per_week: 23, state: "finished" }))).toBeNull();
  });

  test("a trial needing over the most the report counts is always short", () => {
    expect(tasksNote(trial({ per_week: 300, needed: null }))).toContain("may end unclear");
  });

  test("a scheduled trial says it has no tasks yet, without repeating its start", () => {
    expect(tasksNote(trial({ state: "scheduled", tasks_with: 0, tasks_without: 0 }))).toBe("No tasks yet.");
    expect(tasksNote(trial({ state: "scheduled", per_week: 23 }))).toBe(
      "No tasks yet. A week usually brings about 23 per half, so this trial may end unclear.",
    );
  });
});

test("the task bars span the tasks needed, or the tasks done when more", () => {
  expect(taskScale(trial({ needed: 70, tasks_with: 14 }))).toBe(70);
  expect(taskScale(trial({ needed: 70, tasks_with: 95 }))).toBe(95);
  expect(taskScale(trial({ needed: null }))).toBe(320);
  expect(neededWords(trial({ needed: 70 }))).toBe("about 70 needed");
  expect(neededWords(trial({ needed: null }))).toBe("over 320 needed");
});

test("trials sort running, then scheduled soonest first, then finished latest first", () => {
  const sorted = sortTrials([
    trial({ name: "old", state: "finished", started: "2026-10-01" }),
    trial({ name: "later", state: "scheduled", started: "2026-11-20" }),
    trial({ name: "new", state: "finished", started: "2026-11-01" }),
    trial({ name: "soon", state: "scheduled", started: "2026-11-13" }),
    trial({ name: "now", state: "running" }),
  ]);
  expect(sorted.map((t) => t.name)).toEqual(["now", "soon", "later", "new", "old"]);
});

test("the trend runs by day of the trial, padded to its length, keeping gaps", () => {
  const rows = trendRows(
    trial({
      trend: [
        { day: "2026-11-09", with: null, without: 0.2 },
        { day: "2026-11-10", with: 0.1, without: 0.25 },
      ],
    }),
  );
  expect(rows).toHaveLength(7);
  expect(rows[0]).toEqual({ label: "Day 1", with: null, without: 0.2 });
  expect(rows[1]).toEqual({ label: "Day 2", with: 0.1, without: 0.25 });
  expect(rows[6]).toEqual({ label: "Day 7", with: null, without: null });
});

test("the trend stops at the trial's last day, as its header does", () => {
  const trend = Array.from({ length: 8 }, (_, i) => ({
    day: `2026-11-${String(9 + i).padStart(2, "0")}`,
    with: 0.1,
    without: 0.2,
  }));
  expect(trendRows(trial({ trend })).at(-1)?.label).toBe("Day 7");
});

test("a trial's badge says where it is, or its verdict once finished", () => {
  expect(trialBadge(trial({ state: "scheduled" }))).toEqual({ tone: "waiting", text: "Scheduled" });
  expect(trialBadge(trial({ state: "running", verdict: "no verdict yet" }))).toEqual({
    tone: "waiting",
    text: "Running",
  });
  expect(trialBadge(trial({ state: "finished", verdict: "works" }))).toEqual({ tone: "good", text: "Works" });
  expect(trialBadge(trial({ state: "finished", verdict: "can't tell" }))).toEqual({
    tone: "unclear",
    text: "Can't tell",
  });
  const worse = { value: 0.6, low: 0.2, high: 1.1 };
  expect(trialBadge(trial({ state: "finished", verdict: "no useful effect", change: worse })).tone).toBe("bad");
});

test("the overview's trial line gives its tasks once it has started", () => {
  expect(trialSummary(trial({}), "2026-11-12")).toBe("Day 4 of 7 · 14 with · 9 without");
  expect(trialSummary(trial({ state: "scheduled", started: "2026-11-13" }), "2026-11-12")).toBe("Starts 13 Nov");
});

test("a trial's missing change says no mistakes without the rule only with tasks enough in both halves", () => {
  expect(missingTrialChange(trial({ tasks_with: 30, tasks_without: 20 }))).toBe(
    "No mistakes without the rule, so nothing to compare",
  );
  expect(missingTrialChange(trial({ tasks_with: 30, tasks_without: 3 }))).toBe("Too few tasks to tell");
});
