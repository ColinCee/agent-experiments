import { expect, test } from "vitest";
import { emptyReport, fixture } from "@/data/fixture";
import type { PermanentCheck, Report, Trial } from "@/data/report";
import { pickedRow, rowHref } from "./hash";
import { pageRows } from "./rows";
import { ruleStatus, trialStatus } from "./status";
import { ruleTrust, trialTrust } from "./trust";

const trial = (over: Partial<Trial>): Trial => ({
  name: "A trial",
  started: "2026-11-01",
  ends: "2026-11-08",
  state: "running",
  verdict: null,
  tasks_with: 30,
  tasks_without: 30,
  rate_with: 0.1,
  rate_without: 0.2,
  change: { value: -0.5, low: -0.8, high: -0.1 },
  needed: 40,
  per_week: 20,
  looks: [],
  trend: [],
  ...over,
});

const check = (over: Partial<PermanentCheck>): PermanentCheck => ({
  name: "A rule",
  since: "2026-10-01",
  model: "model-a",
  tasks_with: 100,
  tasks_without: 12,
  change: { value: -0.4, low: -0.7, high: 0.15 },
  slipping: false,
  ...over,
});

const report = (over: Partial<Report>): Report => ({ ...emptyReport, ...over });

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

test("a row with no answer carries no change, so a running experiment never shows a lead", () => {
  const [row] = pageRows(report({ trials: [trial({ verdict: "no verdict yet" })] }));
  expect(row.status).toBe("not-enough");
  expect(row.change).toBeNull();
});

test("rows run group by group: unfinished experiments, active rules with not working first, then finished", () => {
  const rows = pageRows(
    report({
      trials: [trial({ name: "Done", state: "finished", verdict: "works" }), trial({ name: "Going" })],
      permanent: [check({ name: "Fine" }), check({ name: "Slipping", slipping: true })],
    }),
  );
  expect(rows.map((row) => `${row.group}:${row.name}`)).toEqual([
    "running:Going",
    "active:Slipping",
    "active:Fine",
    "finished:Done",
  ]);
});

test("every row of the fixture has its own id, and a repeated name gets a number", () => {
  const ids = pageRows(fixture).map((row) => row.id);
  expect(new Set(ids).size).toBe(ids.length);
  const twice = pageRows(report({ trials: [trial({ name: "Same name" }), trial({ name: "Same name" })] }));
  expect(twice.map((row) => row.id)).toEqual(["trial-same-name", "trial-same-name-2"]);
});

test("a link names a row as a plain hash, and every older form of link still opens its row", () => {
  const ids = ["trial-a-trial", "permanent-a-rule"];
  expect(rowHref("permanent-a-rule")).toBe("#permanent-a-rule");
  expect(pickedRow("#permanent-a-rule", ids)).toBe("permanent-a-rule");
  expect(pickedRow("#/?m=trial-a-trial", ids)).toBe("trial-a-trial");
  expect(pickedRow("#/mistakes/a-rule", ids)).toBe("permanent-a-rule");
  expect(pickedRow("#/?m=mistake-a-rule", ids)).toBe("permanent-a-rule");
  expect(pickedRow("#/?m=replay-a-trial", ids)).toBe("trial-a-trial");
});

test("a link to nothing, or to a section that is gone, opens the page with no row picked", () => {
  const ids = ["trial-a-trial"];
  for (const hash of ["", "#", "#/", "#/trials", "#/size", "#/?m=size-rules", "#unknown"]) {
    expect(pickedRow(hash, ids), hash).toBeNull();
  }
});

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
});

test("an active rule is held to the fewest tasks a side can be judged on", () => {
  expect(ruleTrust(check({}))).toMatchObject({ needed: 5, neededWords: "5 at least", enough: "Yes" });
  expect(ruleTrust(check({ tasks_without: 5 })).enough).toBe("Yes");
  expect(ruleTrust(check({ tasks_without: 4 })).enough).toBe("Not yet");
});
