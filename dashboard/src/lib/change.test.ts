import { describe, expect, test } from "vitest";
import { changeWords, isClipped, missingChange, rangeWords, stripPosition } from "./change";

describe("changeWords", () => {
  test("a range wholly below no change reads as fewer mistakes", () => {
    expect(changeWords({ value: -0.61, low: -0.7, high: -0.5 })).toEqual({
      tone: "good",
      lead: "61% fewer",
      hint: "likely 50% to 70% fewer",
      hasRange: true,
    });
  });

  test("a range wholly above no change reads as more mistakes", () => {
    expect(changeWords({ value: 0.37, low: 0.1, high: 1.4 })).toEqual({
      tone: "bad",
      lead: "37% more",
      hint: "likely 10% to 140% more",
      hasRange: true,
    });
  });

  test("a range whose ends round alike names one number", () => {
    expect(changeWords({ value: -0.9, low: -1, high: -0.998 }).hint).toBe("likely 100% fewer");
  });

  test("a range that only repeats the lead is left out", () => {
    expect(changeWords({ value: -1, low: -1, high: -0.998 })).toMatchObject({ lead: "100% fewer", hint: null });
  });

  test("a range across no change is unclear, whichever side the value is", () => {
    for (const value of [-0.4, 0.3]) {
      const words = changeWords({ value, low: -0.6, high: 0.5 });
      expect(words).toMatchObject({ tone: "unclear", lead: "Unclear", hint: "60% fewer to 50% more" });
    }
  });

  test("a range that touches no change is unclear", () => {
    expect(changeWords({ value: -0.5, low: -0.8, high: 0 }).tone).toBe("unclear");
    expect(changeWords({ value: 0.5, low: 0, high: 0.8 }).tone).toBe("unclear");
  });

  test("no range, or no change at all, is too few tasks to tell", () => {
    expect(changeWords({ value: -0.5, low: null, high: null })).toMatchObject({
      lead: "Too few tasks to tell",
      hint: null,
      hasRange: false,
    });
    expect(changeWords(null).lead).toBe("Too few tasks to tell");
  });
});

test("a range reads from its fewer end to its more end", () => {
  expect(rangeWords({ value: 0, low: -0.4, high: 0.12 })).toBe("40% fewer to 12% more");
  expect(rangeWords({ value: 0, low: -0.001, high: 0.3 })).toBe("no change to 30% more");
  expect(rangeWords({ value: 0, low: null, high: null })).toBeNull();
});

test("a slipping rule reads little or no change in red, whatever its range", () => {
  expect(changeWords({ value: 0.05, low: -0.2, high: 0.4 }, "slipping")).toEqual({
    tone: "bad",
    lead: "Little or no change",
    hint: "20% fewer to 40% more",
    hasRange: true,
  });
});

test("an untrusted result keeps its words but is never green or red", () => {
  expect(changeWords({ value: -0.6, low: -0.8, high: -0.4 }, "untrusted")).toMatchObject({
    tone: "unclear",
    lead: "60% fewer",
  });
});

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

test("a missing change with enough tasks means no mistakes on the side compared against", () => {
  expect(missingChange(5, "without the rule")).toBe("No mistakes without the rule, so nothing to compare");
  expect(missingChange(40, "before the rule")).toBe("No mistakes before the rule, so nothing to compare");
  expect(missingChange(4, "without the rule")).toBe("Too few tasks to tell");
  expect(changeWords(null, "plain", missingChange(40, "before the rule")).lead).toBe(
    "No mistakes before the rule, so nothing to compare",
  );
  expect(changeWords({ value: -0.4, low: null, high: null }, "plain", "anything").lead).toBe("Too few tasks to tell");
});
