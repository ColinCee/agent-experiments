import { expect, test } from "vitest";
import { emptyReport, fixture } from "@/data/fixture";
import type { Report } from "@/data/report";
import { trial } from "./made-up";
import { pageRows } from "./rows";

const report = (over: Partial<Report>): Report => ({ ...emptyReport, ...over });

test("a row with no verdict carries no change, so a change under test never shows a lead", () => {
  const [row] = pageRows(report({ trials: [trial({ verdict: null })] }));
  expect(row.status).toBe("due");
  expect(row.change).toBeNull();
});

test("changes under test come first, earliest started first, then verdicts, latest first", () => {
  const rows = pageRows(
    report({
      trials: [
        trial({ name: "Older verdict", due: "2026-11-03" }),
        trial({ name: "Later", verdict: null, due: null, started: "2026-11-05" }),
        trial({ name: "Newer verdict", due: "2026-11-04" }),
        trial({ name: "Sooner", verdict: null, due: null, started: "2026-11-04" }),
      ],
    }),
  );
  expect(rows.map((row) => `${row.group}:${row.name}`)).toEqual([
    "due:Sooner",
    "due:Later",
    "judged:Newer verdict",
    "judged:Older verdict",
  ]);
});

test("every row of the fixture has its own id, and a repeated name gets a number", () => {
  const ids = pageRows(fixture).map((row) => row.id);
  expect(new Set(ids).size).toBe(ids.length);
  const twice = pageRows(report({ trials: [trial({ name: "Same name" }), trial({ name: "Same name" })] }));
  expect(twice.map((row) => row.id)).toEqual(["trial-same-name", "trial-same-name-2"]);
});
