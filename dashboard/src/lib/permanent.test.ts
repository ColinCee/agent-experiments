import { expect, test } from "vitest";
import type { PermanentCheck } from "@/data/report";
import {
  permanentNote,
  permanentRowNote,
  permanentStatus,
  permanentSummary,
  STATUS_TONE,
  STATUS_WORDS,
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

test("the section's one line gives the start only when all rules share it", () => {
  expect(permanentSummary([check({}), check({})], "2026-11-12")).toBe(
    "Proven rules, each left off for 1 task in 10 since 12 Nov",
  );
  expect(permanentSummary([check({}), check({ since: "2026-10-01" })], "2026-11-12")).toBe(
    "Proven rules, each left off for 1 task in 10",
  );
});

test("plenty of tasks but no mistakes without the rule is nothing to compare, not waiting or working", () => {
  const none = check({ tasks_with: 90, tasks_without: 11, change: null });
  expect(permanentNote(none)).toBe("No mistakes without the rule, so nothing to compare");
  expect(permanentStatus(none)).toBe("nothing");
  expect(STATUS_WORDS.nothing).toBe("Nothing to compare");
  expect(STATUS_TONE.nothing).toBe("unclear");
});

test('a row says why there is no strip in a few words, leaving "nothing to compare" to its status', () => {
  expect(permanentRowNote(check({ tasks_with: 90, tasks_without: 11, change: null }))).toBe(
    "No mistakes without the rule",
  );
  expect(permanentRowNote(check({ tasks_without: 0, change: null }))).toBe("No tasks without the rule yet");
  expect(permanentRowNote(check({}))).toBeNull();
});
