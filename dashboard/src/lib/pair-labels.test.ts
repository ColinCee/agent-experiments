import { expect, test } from "vitest";
import { LABEL_ROOM, layoutPair } from "./pair-labels";

// Every character 7px wide, on a 200px track.
const measure = (text: string) => text.length * 7;

test("the left dot's number sits just left of it and the right dot's just right of it", () => {
  const [left, right] = layoutPair(0.31, 0.6, 200, measure);
  expect(left).toEqual({ text: "31%", side: "without", left: 62 - LABEL_ROOM - 21, width: 21 });
  expect(right).toEqual({ text: "60%", side: "with", left: 120 + LABEL_ROOM, width: 21 });
});

test("a fall puts since on the left and before on the right, each in its own colour", () => {
  expect(layoutPair(0.6, 0.3, 200, measure).map((l) => [l.side, l.text])).toEqual([
    ["with", "30%"],
    ["without", "60%"],
  ]);
});

test("equal rates keep before on the left and since on the right", () => {
  expect(layoutPair(0.01, 0.01, 200, measure).map((l) => l.side)).toEqual(["without", "with"]);
});

test("at the track's ends the numbers go into the gutters outside it, never inside", () => {
  const [left, right] = layoutPair(0, 1, 200, measure);
  expect(left.left + left.width).toBeLessThanOrEqual(-LABEL_ROOM);
  expect(right.left).toBeGreaterThanOrEqual(200 + LABEL_ROOM);
});

test("one side alone has its number to the right of its dot", () => {
  expect(layoutPair(null, 0.3, 200, measure)).toEqual([{ text: "30%", side: "with", left: 69, width: 21 }]);
  expect(layoutPair(null, null, 200, measure)).toEqual([]);
});
