import { expect, test } from "vitest";
import { trial } from "./made-up";
import { trialStatus } from "./status";

test("a change's status is its verdict, and before one its verdict is due", () => {
  expect(trialStatus(trial({ verdict: "works" }))).toBe("works");
  expect(trialStatus(trial({ verdict: "worse" }))).toBe("worse");
  expect(trialStatus(trial({ verdict: "no big effect" }))).toBe("no-effect");
  expect(trialStatus(trial({ verdict: null }))).toBe("due");
});
