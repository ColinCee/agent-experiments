import { expect, test } from "vitest";
import { dayLabel, percent, plural, signedPercent, timeLabel } from "./format";

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
});

test("the written time is shown in the given time zone", () => {
  expect(timeLabel("2026-11-12T21:17:05+00:00", "UTC")).toBe("12 Nov, 21:17");
  expect(timeLabel("2026-11-12T21:17:05+00:00", "Asia/Tokyo")).toBe("13 Nov, 06:17");
  expect(timeLabel("2026-09-03T00:05:00Z", "UTC")).toBe("3 Sep, 00:05");
});

test("a change is a signed whole percent, with no sign on no change", () => {
  expect(signedPercent(-0.634)).toBe("−63%");
  expect(signedPercent(0.06)).toBe("+6%");
  expect(signedPercent(1.33)).toBe("+133%");
  expect(signedPercent(-0.004)).toBe("0%");
});
