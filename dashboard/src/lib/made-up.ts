// A made-up experiment and active rule for the tests in this folder; each test changes only what it is about.
import type { PermanentCheck, Trial } from "@/data/report";

export const trial = (over: Partial<Trial>): Trial => ({
  name: "A trial",
  started: "2026-11-01",
  ends: "2026-11-08",
  state: "running",
  verdict: null,
  tasks_with: 30,
  tasks_without: 30,
  rate_with: 0.1,
  rate_without: 0.2,
  change: { value: -0.5, low: -0.8, high: -0.1 },
  needed: 40,
  per_week: 20,
  looks: [],
  trend: [],
  misses: [],
  ...over,
});

export const check = (over: Partial<PermanentCheck>): PermanentCheck => ({
  name: "A rule",
  since: "2026-10-01",
  model: "model-a",
  tasks_with: 100,
  tasks_without: 12,
  rate_with: 0.12,
  rate_without: 0.2,
  change: { value: -0.4, low: -0.7, high: 0.15 },
  slipping: false,
  needed: 40,
  trend: [],
  misses: [],
  ...over,
});
