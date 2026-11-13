import { expect, test } from "vitest";
import { filesOf, growthWords, sparkPoints, wordsAdded } from "./sizes";

test("growth is words added since the first point, signed, or no change", () => {
  const points = (first: number, last: number) => ({
    label: "Rules" as const,
    now: last,
    points: [
      { day: "2026-10-03", words: first },
      { day: "2026-11-12", words: last },
    ],
  });
  expect(growthWords(points(500, 1700), "2026-11-12")).toBe("+1,200 since 3 Oct");
  expect(growthWords(points(900, 700), "2026-11-12")).toBe("−200 since 3 Oct");
  expect(growthWords(points(700, 700), "2026-11-12")).toBe("No change since 3 Oct");
  expect(growthWords({ ...points(0, 0), points: [] }, "2026-11-12")).toBeNull();
});

test("a size's row says the words added, signed", () => {
  const series = (first: number, last: number) => ({
    label: "Rules" as const,
    now: last,
    points: [
      { day: "2026-10-03", words: first },
      { day: "2026-11-12", words: last },
    ],
  });
  expect(wordsAdded(series(500, 1700))).toBe("+1,200 words");
  expect(wordsAdded(series(900, 700))).toBe("−200 words");
  expect(wordsAdded(series(700, 700))).toBe("No change");
});

test("skills files are those under a skills folder; rules files are the rest", () => {
  const largest = [
    { file: "skills/a/SKILL.md", words: 3 },
    { file: "rules/team.md", words: 2 },
    { file: "home/core.md", words: 1 },
  ];
  expect(filesOf("Skills", largest).map((f) => f.file)).toEqual(["skills/a/SKILL.md"]);
  expect(filesOf("Rules", largest).map((f) => f.file)).toEqual(["rules/team.md", "home/core.md"]);
});

test("a sparkline runs across the box with 0 words at its bottom and the most at its top", () => {
  const points = [
    { day: "2026-10-01", words: 0 },
    { day: "2026-10-02", words: 50 },
    { day: "2026-10-03", words: 100 },
  ];
  expect(sparkPoints(points, 100, 20)).toBe("0,20 50,10 100,0");
});
