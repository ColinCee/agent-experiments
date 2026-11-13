import { describe, expect, test } from "vitest";
import { changeInBrief, changeWords, stripPosition } from "./change";

describe("changeWords", () => {
  test("a range wholly below no change reads as fewer mistakes", () => {
    expect(changeWords({ value: -0.83, low: -0.89, high: -0.74 })).toEqual({
      tone: "good",
      lead: "83% fewer",
      hint: "likely 74% to 89% fewer",
      hasRange: true,
    });
  });

  test("a range wholly above no change reads as more mistakes", () => {
    expect(changeWords({ value: 0.52, low: 0.1, high: 1.4 })).toEqual({
      tone: "bad",
      lead: "52% more",
      hint: "likely 10% to 140% more",
      hasRange: true,
    });
  });

  test("a range whose ends round alike names one number", () => {
    expect(changeWords({ value: -1, low: -1, high: -0.998 }).hint).toBe("likely 100% fewer");
  });

  test("a range across no change is unclear, whichever side the value is", () => {
    for (const value of [-0.4, 0.3]) {
      const words = changeWords({ value, low: -0.6, high: 0.5 });
      expect(words).toMatchObject({ tone: "unclear", lead: "Unclear", hint: "could be no change" });
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

test("changeInBrief gives the lead when clear and a hint otherwise", () => {
  expect(changeInBrief({ value: 0.52, low: 0.1, high: 1 })).toBe("52% more");
  expect(changeInBrief({ value: 0.05, low: -0.2, high: 0.4 })).toBe("could be no change");
  expect(changeInBrief(null)).toBe("too few tasks to tell");
});

describe("stripPosition", () => {
  test("maps -100% to the left end, no change to the centre and +100% to the right end", () => {
    expect(stripPosition(-1)).toBe(0);
    expect(stripPosition(0)).toBe(0.5);
    expect(stripPosition(1)).toBe(1);
    expect(stripPosition(-0.5)).toBe(0.25);
  });

  test("holds values beyond +100% at the right edge", () => {
    expect(stripPosition(2.1)).toBe(1);
  });
});
