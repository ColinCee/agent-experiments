import { expect, test } from "vitest";
import { handText } from "./hand";
import { trial } from "./made-up";
import type { Row } from "./rows";

const misses = [
  { day: "2026-11-03", session: "id-later" },
  { day: "2026-11-02", session: "id-earlier" },
];

test("the copied request names the change, its result and numbers, and each session behind its latest misses", () => {
  const row: Row = {
    id: "trial-a-change",
    name: "A change",
    status: "works",
    change: { value: -0.5, low: -0.8, high: -0.1 },
    trial: trial({ misses }),
  };
  const text = handText(row, "2026-11-05");
  expect(text).toContain('"A change"');
  expect(text).toContain("rule change of 2026-11-01, as of 2026-11-05: Works");
  expect(text).toContain("before the change 20% over 80 tasks, since it 10% over 12 tasks");
  expect(text).toContain("−50% (90% range −80% to −10%)");
  expect(text).toContain("- id-later (2026-11-03)\n- id-earlier (2026-11-02)");
});

test("with no misses it asks for the counting to be checked, and with no verdict it gives no range", () => {
  const row: Row = {
    id: "trial-a-change",
    name: "A change",
    status: "due",
    change: null,
    trial: trial({ verdict: null, after: null }),
  };
  const text = handText(row, "2026-11-01");
  expect(text).toContain("Verdict due");
  expect(text).toContain("since it none counted");
  expect(text).not.toContain("90% range");
  expect(text).toContain("No session has missed since the change");
});
