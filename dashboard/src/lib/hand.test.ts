import { expect, test } from "vitest";
import { handText } from "./hand";
import { check, trial } from "./made-up";
import type { Row } from "./rows";

const misses = [
  { day: "2026-11-27", side: "without" as const, session: "id-without" },
  { day: "2026-11-26", side: "with" as const, session: "id-with" },
];

test("the copied request names the rule, its result and numbers, and each session behind its latest misses", () => {
  const row: Row = {
    kind: "permanent",
    id: "permanent-a-rule",
    name: "A rule",
    group: "active",
    status: "works",
    change: { value: -0.4, low: -0.7, high: 0.15 },
    check: check({ misses }),
  };
  const text = handText(row, "2026-11-28");
  expect(text).toContain('"A rule"');
  expect(text).toContain("active rule's result as of 2026-11-28: Works");
  expect(text).toContain("with the rule 12% over 100 tasks, without it 20% over 12 tasks");
  expect(text).toContain("−40% (90% range −70% to +15%)");
  expect(text).toContain("- id-without (2026-11-27, without it)\n- id-with (2026-11-26, with the rule)");
});

test("with no misses it asks for the counting to be checked, and an experiment says so", () => {
  const row: Row = {
    kind: "trial",
    id: "trial-a-trial",
    name: "A trial",
    group: "running",
    status: "cant-tell",
    change: null,
    trial: trial({ rate_without: null }),
  };
  const text = handText(row, "2026-11-28");
  expect(text).toContain("experiment's result");
  expect(text).toContain("without it none counted");
  expect(text).not.toContain("90% range");
  expect(text).toContain("No session in its tasks has missed yet");
});
