import { expect, test } from "vitest";
import { emptyReport, fixture } from "@/data/fixture";
import type { Report } from "@/data/report";
import { trial } from "./made-up";
import { pageRows } from "./rows";

const report = (over: Partial<Report>): Report => ({ ...emptyReport, ...over });

test("a row with no verdict carries no change, and is named for the change when its words are known", () => {
  const [row] = pageRows(report({ trials: [trial({ verdict: null, what: "A hook asks first" })] }));
  expect([row.status, row.change, row.name]).toEqual(["due", null, "A hook asks first"]);
  expect(pageRows(report({ trials: [trial({ what: null })] }))[0].name).toBe("A change");
});

test("changes under test come first, earliest started first, then verdicts, latest first", () => {
  const rows = pageRows(
    report({
      trials: [
        trial({ name: "Older verdict", due: "2026-11-03" }),
        trial({ name: "Later", verdict: null, started: "2026-11-05" }),
        trial({ name: "Newer verdict", due: "2026-11-04" }),
        trial({ name: "Sooner", verdict: null, started: "2026-11-04" }),
      ],
    }),
  );
  expect(rows.map((row) => row.name)).toEqual(["Sooner", "Later", "Newer verdict", "Older verdict"]);
});

test("every row of the fixture has its own id, and a repeated name gets a number", () => {
  const ids = pageRows(fixture).map((row) => row.id);
  expect(new Set(ids).size).toBe(ids.length);
  const twice = pageRows(report({ trials: [trial({ name: "Same name" }), trial({ name: "Same name" })] }));
  expect(twice.map((row) => row.id)).toEqual(["trial-same-name", "trial-same-name-2"]);
});
