import { expect, test } from "vitest";
import type { PermanentCheck } from "@/data/report";
import { permanentStatus } from "./permanent";

const check = (over: Partial<PermanentCheck>): PermanentCheck => ({
  name: "A rule",
  since: "2026-11-12",
  model: "model-a",
  tasks_with: 100,
  tasks_without: 12,
  change: { value: -0.5, low: -0.8, high: -0.2 },
  slipping: false,
  ...over,
});

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
