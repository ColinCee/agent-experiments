import { expect, test } from "vitest";
import type { Trial } from "@/data/report";
import { lookLabels, sortTrials, trendRows } from "./trials";

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

test("the trend stops at the trial's last day", () => {
  const trend = Array.from({ length: 8 }, (_, i) => ({
    day: `2026-11-${String(9 + i).padStart(2, "0")}`,
    with: 0.1,
    without: 0.2,
  }));
  expect(trendRows(trial({ trend })).at(-1)?.label).toBe("Day 7");
});

test("each day a trial was checked is marked on a day the trend has, the last one on its last day", () => {
  const look = (day: string) => ({
    look: 1,
    day,
    verdict: "no verdict yet" as const,
    tasks_with: 10,
    tasks_without: 10,
  });
  expect(lookLabels(trial({ looks: [look("2026-11-11"), look("2026-11-16")] }))).toEqual(["Day 3", "Day 7"]);
});
