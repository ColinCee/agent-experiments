// A made-up rule change for the tests in this folder; each test changes only what it is about.
import type { Trial } from "@/data/report";

export const trial = (over: Partial<Trial>): Trial => ({
  name: "A change",
  what: null,
  started: "2026-11-01",
  status: "testing",
  due: "2026-11-03",
  real_days: 3,
  rare: false,
  before: { rate: 0.2, low: 0.15, high: 0.25, tasks: 80, from: "2026-10-01" },
  after: { rate: 0.1, low: 0.05, high: 0.15, tasks: 12, from: "2026-11-01" },
  change: { value: -0.5, low: -0.8, high: -0.1 },
  verdict: "works",
  source: "before and after",
  replay: null,
  misses: [],
  ...over,
});
