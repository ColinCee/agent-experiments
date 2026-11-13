import { expect, test } from "vitest";
import { layoutLabels, rateCeiling, rateTicks } from "./charts";

test("the rate axis tops out at the smallest of 20%, 50% or 100% that holds the data, on round ticks", () => {
  expect(rateCeiling([0.1, null, 0.2])).toBe(0.2);
  expect(rateCeiling([0.21])).toBe(0.5);
  expect(rateCeiling([0.5])).toBe(0.5);
  expect(rateCeiling([0.51, 0.2])).toBe(1);
  expect(rateCeiling([null, null])).toBe(0.2);
  expect(rateTicks(0.2)).toEqual([0, 0.05, 0.1, 0.15, 0.2]);
  expect(rateTicks(0.5)).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5]);
  expect(rateTicks(1)).toEqual([0, 0.25, 0.5, 0.75, 1]);
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
