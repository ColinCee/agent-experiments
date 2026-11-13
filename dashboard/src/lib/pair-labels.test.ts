import { expect, test } from "vitest";
import { layoutPair } from "./pair-labels";

// Every character 7px wide, on a 200px track.
const measure = (text: string) => text.length * 7;
const text = (labels: ReturnType<typeof layoutPair>) => labels.map((l) => l.parts.map((p) => p.text).join(""));

test("apart, the left dot's number goes to its left and the right dot's to its right", () => {
  const labels = layoutPair(0.31, 0.6, 200, measure);
  expect(text(labels)).toEqual(["31%", "60%"]);
  expect(labels[0].left + labels[0].width).toBeLessThanOrEqual(0.31 * 200 - 9);
  expect(labels[1].left).toBeGreaterThanOrEqual(0.6 * 200 + 9);
});

test("a fall puts since on the left and before on the right, each in its own colour", () => {
  const labels = layoutPair(0.6, 0.3, 200, measure);
  expect(labels.map((l) => l.parts[0].side)).toEqual(["with", "without"]);
});

test("close dots share one label, before first, to the right of the pair", () => {
  const labels = layoutPair(0.01, 0.01, 200, measure);
  expect(text(labels)).toEqual(["1% → 1%"]);
  expect(labels[0].left).toBeGreaterThanOrEqual(0.01 * 200 + 9);
});

test("with no room outside, the pair shares one label on the side that has room", () => {
  // 0% leaves no room on the left; 100% none on the right.
  expect(text(layoutPair(0, 0.4, 200, measure))).toEqual(["0% → 40%"]);
  const high = layoutPair(1, 0.67, 200, measure);
  expect(text(high)).toEqual(["100% → 67%"]);
  expect(high[0].left + high[0].width).toBeLessThanOrEqual(0.67 * 200 - 9);
});

test("labels never leave the track", () => {
  for (const [b, a] of [
    [0, 1],
    [1, 0],
    [0, 0],
    [1, 1],
    [0.5, 0.52],
  ]) {
    for (const label of layoutPair(b, a, 200, measure)) {
      expect(label.left).toBeGreaterThanOrEqual(0);
      expect(label.left + label.width).toBeLessThanOrEqual(200);
    }
  }
});

test("one side alone labels its dot, to the right if it fits", () => {
  expect(layoutPair(null, 0.3, 200, measure)).toEqual([
    { parts: [{ text: "30%", side: "with" }], left: 69, width: 21 },
  ]);
  expect(layoutPair(1, null, 200, measure)[0].left).toBe(200 - 9 - 28);
  expect(layoutPair(null, null, 200, measure)).toEqual([]);
});

test("a pair spanning the track with no room either side puts its label under the line, between the dots", () => {
  const [label] = layoutPair(1, 0.33, 200, measure);
  expect(label.below).toBe(true);
  expect(label.left).toBeGreaterThanOrEqual(0.33 * 200 + 9);
  expect(label.left + label.width).toBeLessThanOrEqual(200);
});
