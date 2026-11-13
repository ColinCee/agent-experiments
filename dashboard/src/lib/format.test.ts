import { expect, test } from "vitest";
import { dayLabel, fewTasks, monthLabel, percent, plural, timeLabel } from "./format";

test("percent rounds a fraction to a whole percent", () => {
  expect(percent(0.314)).toBe("31%");
  expect(percent(0.315)).toBe("32%");
  expect(percent(1.4)).toBe("140%");
});

test("plural uses the singular for one only", () => {
  expect(plural(1, "task")).toBe("1 task");
  expect(plural(0, "task")).toBe("0 tasks");
  expect(plural(1200, "task")).toBe("1,200 tasks");
});

test("a day shows its year only when it is not the report's year", () => {
  expect(dayLabel("2026-11-08", "2026-11-12")).toBe("8 Nov");
  expect(dayLabel("2025-12-30", "2026-01-02")).toBe("30 Dec 2025");
  expect(monthLabel("2026-10", "2026-11-12")).toBe("Oct");
  expect(monthLabel("2025-12", "2026-01-02")).toBe("Dec 2025");
});

test("the written time is shown in the given time zone", () => {
  expect(timeLabel("2026-11-12T21:17:05+00:00", "UTC")).toBe("12 Nov, 21:17");
  expect(timeLabel("2026-11-12T21:17:05+00:00", "Asia/Tokyo")).toBe("13 Nov, 06:17");
  expect(timeLabel("2026-09-03T00:05:00Z", "UTC")).toBe("3 Sep, 00:05");
});

test("a pair of rates on few tasks says how few, and says nothing at 10 or more", () => {
  const pair = (before: number | undefined, since: number | undefined) =>
    fewTasks([
      { tasks: before, label: "before" },
      { tasks: since, label: "since the rule" },
    ]);
  expect(pair(80, 3)).toBe("only 3 tasks since the rule");
  expect(pair(7, 80)).toBe("only 7 tasks before");
  expect(pair(6, 3)).toBe("only 6 tasks before and 3 since the rule");
  expect(pair(1, 50)).toBe("only 1 task before");
  expect(pair(10, 10)).toBeNull();
  expect(pair(undefined, 0)).toBeNull();
});
