import { expect, test } from "vitest";
import type { PermanentCheck } from "@/data/report";
import { check as madeUp } from "./made-up";
import { checkRows, permanentStatus } from "./permanent";

const check = (over: Partial<PermanentCheck>): PermanentCheck =>
  madeUp({ since: "2026-11-12", change: { value: -0.5, low: -0.8, high: -0.2 }, ...over });

test("status is slipping, waiting for tasks, or still working", () => {
  expect(permanentStatus(check({ slipping: true }))).toBe("slipping");
  expect(permanentStatus(check({ tasks_without: 0, change: null }))).toBe("waiting");
  expect(permanentStatus(check({ tasks_without: 4 }))).toBe("waiting");
  expect(permanentStatus(check({ tasks_without: 5 }))).toBe("working");
  expect(permanentStatus(check({}))).toBe("working");
});

test("plenty of tasks but no mistakes without the rule is nothing to compare, not waiting or working", () => {
  expect(permanentStatus(check({ tasks_with: 90, tasks_without: 11, change: null }))).toBe("nothing");
});

test("an active rule's chart labels each day by date and names every 7th back from the last on its axis", () => {
  const trend = Array.from({ length: 28 }, (_, i) => ({
    day: `2026-11-${String(i + 1).padStart(2, "0")}`,
    with: 0.1,
    without: null,
  }));
  const { rows, ticks } = checkRows(check({ trend }), "2026-11-28");
  expect(rows[0]).toEqual({ label: "1 Nov", with: 0.1, without: null });
  expect(ticks).toEqual(["7 Nov", "14 Nov", "21 Nov", "28 Nov"]);
});
