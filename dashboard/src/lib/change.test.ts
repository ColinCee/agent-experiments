import { describe, expect, test } from "vitest";
import { isClipped, stripPosition } from "./change";

describe("stripPosition", () => {
  test("maps -100% to the left end, no change to the centre and +100% to the right end", () => {
    expect(stripPosition(-1)).toBe(0);
    expect(stripPosition(0)).toBe(0.5);
    expect(stripPosition(1)).toBe(1);
    expect(stripPosition(-0.5)).toBe(0.25);
  });

  test("holds values beyond +100% at the right edge, and says so", () => {
    expect(stripPosition(2.1)).toBe(1);
    expect(isClipped({ value: 0.6, low: 0.2, high: 2.1 })).toBe(true);
    expect(isClipped({ value: 1.3, low: null, high: null })).toBe(true);
    expect(isClipped({ value: 0.6, low: 0.2, high: 1 })).toBe(false);
    expect(isClipped(null)).toBe(false);
  });
});
