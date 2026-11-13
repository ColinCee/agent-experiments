import { expect, test } from "vitest";
import { emptyReport, fixture } from "@/data/fixture";
import { firstPick, pageRows, rowId } from "./rows";

test("rows come section by section in page order, each with a unique id", () => {
  const rows = pageRows(fixture);
  const sections = rows.map((r) => r.section);
  const order = ["trials", "permanent", "rules", "no-rule", "replays", "size"];
  expect([...new Set(sections)]).toEqual(order);
  expect(sections).toEqual(sections.toSorted((a, b) => order.indexOf(a) - order.indexOf(b)));
  expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
});

test("the same name in two kinds gets two ids, and a repeated name in one kind gets a number", () => {
  const twice = { ...fixture, trials: [fixture.trials[0], fixture.trials[0]] };
  const ids = pageRows(twice)
    .filter((r) => r.kind === "trial")
    .map((r) => r.id);
  expect(ids).toEqual([rowId("trial", fixture.trials[0].name), `${rowId("trial", fixture.trials[0].name)}-2`]);
  expect(rowId("trial", "A b")).not.toBe(rowId("mistake", "A b"));
});

test("the first pick is the first attention item's row, else the first mistake with a rule", () => {
  const rows = pageRows(fixture);
  const slipping = rows.find((r) => r.kind === "permanent");
  expect(firstPick(rows, ["nowhere", slipping?.id ?? ""])?.id).toBe(slipping?.id);
  expect(firstPick(rows, [])?.section).toBe("rules");
  expect(firstPick(pageRows(emptyReport), [])?.section).toBe("rules");
  expect(firstPick([], [])).toBeUndefined();
});
