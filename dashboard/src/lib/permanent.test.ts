import { expect, test } from "vitest";
import type { PermanentCheck } from "@/data/report";
import {
  permanentNote,
  permanentStatus,
  permanentSummary,
  STATUS_TONE,
  STATUS_WORDS,
  sharedModel,
  statusCounts,
} from "./permanent";

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

test("no tasks without the rule says so instead of a strip", () => {
  expect(permanentNote(check({ tasks_with: 1, tasks_without: 0, change: null }))).toBe("No tasks without the rule yet");
});

test("fewer than 5 in the smaller group is too few to tell", () => {
  expect(permanentNote(check({ tasks_without: 4 }))).toBe("Too few tasks to tell (needs 5)");
  expect(permanentNote(check({ tasks_without: 5 }))).toBeNull();
});

test("status is slipping, waiting for tasks, or still working", () => {
  expect(permanentStatus(check({ slipping: true }))).toBe("slipping");
  expect(permanentStatus(check({ tasks_without: 0, change: null }))).toBe("waiting");
  expect(permanentStatus(check({ tasks_without: 3 }))).toBe("waiting");
  expect(permanentStatus(check({}))).toBe("working");
});

test("the model is named once only when every row shares it", () => {
  expect(sharedModel([check({}), check({})])).toBe("model-a");
  expect(sharedModel([check({}), check({ model: "model-b" })])).toBeNull();
  expect(sharedModel([check({}), check({ model: null })])).toBeNull();
  expect(sharedModel([])).toBeNull();
});

test("the summary gives the start only when all rules share it", () => {
  expect(permanentSummary([check({}), check({})], "2026-11-12")).toBe(
    "2 proven rules, each left off for 1 task in 10 since 12 Nov",
  );
  expect(permanentSummary([check({}), check({ since: "2026-10-01" })], "2026-11-12")).toBe(
    "2 proven rules, each left off for 1 task in 10",
  );
  expect(permanentSummary([], "2026-11-12")).toBe("No proven rules yet");
});

test("status counts leave out statuses no rule has", () => {
  expect(statusCounts([check({}), check({}), check({ slipping: true }), check({ tasks_without: 0 })])).toBe(
    "2 still working · 1 slipping · 1 waiting for tasks",
  );
  expect(statusCounts([check({ tasks_without: 0 })])).toBe("1 waiting for tasks");
});

test("plenty of tasks but no mistakes without the rule is nothing to compare, not waiting or working", () => {
  const none = check({ tasks_with: 90, tasks_without: 11, change: null });
  expect(permanentNote(none)).toBe("No mistakes without the rule, so nothing to compare");
  expect(permanentStatus(none)).toBe("nothing");
  expect(STATUS_WORDS.nothing).toBe("Nothing to compare");
  expect(STATUS_TONE.nothing).toBe("unclear");
  expect(statusCounts([none, check({})])).toBe("1 still working · 1 nothing to compare");
});
