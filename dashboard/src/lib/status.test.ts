import { expect, test } from "vitest";
import { check, trial } from "./made-up";
import { ruleStatus, trialStatus } from "./status";

test("an experiment's status is its verdict, and it has none before one", () => {
  expect(trialStatus(trial({ verdict: "works" }))).toBe("works");
  expect(trialStatus(trial({ verdict: "no useful effect" }))).toBe("not-working");
  expect(trialStatus(trial({ verdict: "can't tell" }))).toBe("cant-tell");
  expect(trialStatus(trial({ verdict: "no verdict yet" }))).toBe("not-enough");
  expect(trialStatus(trial({ verdict: null, state: "scheduled" }))).toBe("not-enough");
});

test("an active rule works while its range still reaches a 30% cut, even across no change", () => {
  expect(ruleStatus(check({}))).toBe("works");
  expect(ruleStatus(check({ slipping: true }))).toBe("not-working");
  expect(ruleStatus(check({ tasks_without: 3 }))).toBe("not-enough");
  expect(ruleStatus(check({ change: null }))).toBe("not-enough");
});
