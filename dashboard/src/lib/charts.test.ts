import { expect, test } from "vitest";
import { rateCeiling, rateTicks } from "./charts";

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
