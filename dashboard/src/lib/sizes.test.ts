import { expect, test } from "vitest";
import { growthWords } from "./sizes";

test("growth is words added since the first point, signed, or no change", () => {
  const points = (first: number, last: number) => ({
    label: "Rules" as const,
    now: last,
    change: null,
    points: [
      { day: "2026-10-14", words: first },
      { day: "2026-11-12", words: last },
    ],
  });
  expect(growthWords(points(769, 1804), "2026-11-12")).toBe("+1,035 since 14 Oct");
  expect(growthWords(points(900, 700), "2026-11-12")).toBe("−200 since 14 Oct");
  expect(growthWords(points(700, 700), "2026-11-12")).toBe("No change since 14 Oct");
  expect(growthWords({ ...points(0, 0), points: [] }, "2026-11-12")).toBeNull();
});
