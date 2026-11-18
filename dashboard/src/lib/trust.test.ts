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

test("an active rule needs the tasks to find a halving, and only a young one can still reach them", () => {
  const day = "2026-11-28";
  expect(ruleTrust(check({ needed: 12 }), day)).toMatchObject({ needed: 12, neededWords: "12 needed", enough: "Yes" });
  // A month old, its 28 days hold all the tasks they will: a short side stays short.
  expect(ruleTrust(check({ since: "2026-10-01", tasks_without: 12, needed: 40 }), day).enough).toBe("Not at this pace");
  // A week old, 3 tasks a week on the short side: 3 more weeks fill it to 12.
  expect(ruleTrust(check({ since: "2026-11-22", tasks_without: 3, needed: 12 }), day).enough).toBe("In about 3 weeks");
  expect(ruleTrust(check({ since: "2026-11-22", tasks_without: 0, needed: 12 }), day).enough).toBe("Not at this pace");
  expect(ruleTrust(check({ needed: null }), day)).toMatchObject({
    needed: 320,
    neededWords: "over 320 needed",
    enough: "Not at this pace",
  });
});
