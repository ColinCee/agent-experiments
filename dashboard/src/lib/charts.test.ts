import { expect, test } from "vitest";
import { layoutLabels, rateCeiling, rateTicks } from "./charts";

test("the rate axis tops out at the smallest of 25%, 50% or 100% that holds the data", () => {
  expect(rateCeiling([0.1, null, 0.24])).toBe(0.25);
  expect(rateCeiling([0.26])).toBe(0.5);
  expect(rateCeiling([0.5])).toBe(0.5);
  expect(rateCeiling([0.51, 0.2])).toBe(1);
  expect(rateCeiling([null, null])).toBe(0.25);
  expect(rateTicks(0.25)).toEqual([0, 0.0625, 0.125, 0.1875, 0.25]);
});

test("labels far apart share the first row, centred", () => {
  expect(
    layoutLabels(
      [
        { x: 100, width: 40 },
        { x: 200, width: 40 },
      ],
      0,
      300,
    ),
  ).toEqual([
    { row: 0, anchor: "middle" },
    { row: 0, anchor: "middle" },
  ]);
});

test("labels at the edges are anchored inward", () => {
  const [first, last] = layoutLabels(
    [
      { x: 5, width: 40 },
      { x: 298, width: 40 },
    ],
    0,
    300,
  );
  expect(first.anchor).toBe("start");
  expect(last.anchor).toBe("end");
});

test("of two overlapping labels the earlier moves up a row, and a third with no room loses its label", () => {
  const slots = layoutLabels(
    [
      { x: 100, width: 40 },
      { x: 110, width: 40 },
      { x: 120, width: 40 },
    ],
    0,
    300,
  );
  expect(slots.map((s) => s.row)).toEqual([null, 1, 0]);
});
