import { expect, test } from "vitest";
import { check, trial } from "./made-up";
import { ruleTrust, trialTrust } from "./trust";

test("an experiment needs the tasks to find a halving, and says how long that is at its pace", () => {
  expect(trialTrust(trial({ tasks_with: 12, tasks_without: 14 }))).toMatchObject({
    needed: 40,
    neededWords: "40 needed",
    enough: "In about 2 weeks",
  });
  expect(trialTrust(trial({ tasks_with: 40, tasks_without: 41 })).enough).toBe("Yes");
  expect(trialTrust(trial({ state: "finished", tasks_without: 20 })).enough).toBe("Ended short");
  expect(trialTrust(trial({ needed: null }))).toMatchObject({
    neededWords: "over 320 needed",
    enough: "Not at this pace",
  });
  expect(trialTrust(trial({ per_week: 0, tasks_without: 3 })).enough).toBe("Not at this pace");
});

test("an active rule is held to the fewest tasks a side can be judged on", () => {
  expect(ruleTrust(check({}))).toMatchObject({ needed: 5, neededWords: "5 at least", enough: "Yes" });
  expect(ruleTrust(check({ tasks_without: 5 })).enough).toBe("Yes");
  expect(ruleTrust(check({ tasks_without: 4 })).enough).toBe("Not yet");
});
