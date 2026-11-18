import { expect, test } from "vitest";
import { fixture } from "@/data/fixture";
import type { Skill } from "@/data/report";
import { skillChart, skillRows } from "./skills";

const skill = (name: string, rate: number | null): Skill => ({
  name,
  skills: [name],
  now: rate === null ? null : { rate, low: null, high: null, tasks: 10, from: "2026-11-01" },
  series: [],
  versions: [],
  misses: [],
});

test("skills missed most come first, and one no task needed yet comes last", () => {
  const rows = skillRows({ ...fixture, skills: [skill("Unused", null), skill("Low", 0.1), skill("High", 0.7)] });
  expect(rows.map((r) => r.name)).toEqual(["High", "Low", "Unused"]);
  expect(rows[0].id).toBe("skill-high");
});

test("a version first loaded before the chart starts gets no mark; a day with new versions gets one", () => {
  const day = "2026-11-12";
  const s: Skill = {
    ...skill("A", 0.2),
    series: [
      { day: "2026-11-10", rate: 0.2 },
      { day: "2026-11-11", rate: null },
      { day: "2026-11-12", rate: 0.1 },
    ],
    versions: [
      { version: "c", skill: "a", since: "2026-11-11", tasks: 0, rate: null, low: null, high: null },
      { version: "b", skill: "a", since: "2026-11-11", tasks: 1, rate: null, low: null, high: null },
      { version: "a", skill: "a", since: "2026-09-01", tasks: 12, rate: 0.3, low: 0.1, high: 0.5 },
    ],
  };
  const chart = skillChart(s, day);
  expect(chart.marks).toEqual(["11 Nov"]);
  expect(chart.rows.map((r) => r.with)).toEqual([0.2, null, 0.1]);
});
