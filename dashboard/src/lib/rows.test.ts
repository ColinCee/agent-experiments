import { expect, test } from "vitest";
import { emptyReport, fixture } from "@/data/fixture";
import type { Report } from "@/data/report";
import { check, trial } from "./made-up";
import { pageRows } from "./rows";

const report = (over: Partial<Report>): Report => ({ ...emptyReport, ...over });

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
