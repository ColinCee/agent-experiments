import { expect, test } from "vitest";
import { fixture } from "@/data/fixture";
import type { Mistake, Report } from "@/data/report";
import { attentionItems, calmLine, needsHim } from "./attention";

const today = (rate: number, outside: "above" | "below" | null): Mistake["today"] => ({
  rate,
  usual_low: 0.1,
  usual_high: 0.4,
  outside,
});

const report = (over: Partial<Report>): Report => ({
  ...fixture,
  trials: [],
  permanent: [],
  mistakes: [],
  ...over,
});

const mistake = (name: string, t: Mistake["today"]): Mistake => ({ ...fixture.mistakes[0], name, today: t });

test("a mistake above its usual range needs attention, furthest above first", () => {
  const items = attentionItems(
    report({ mistakes: [mistake("a bit", today(0.45, "above")), mistake("a lot", today(0.9, "above"))] }),
  );
  expect(items.map((i) => i.title)).toEqual(["a lot", "a bit"]);
  expect(items[0]).toEqual({ tone: "bad", title: "a lot", detail: "90% on 12 Nov · usually 10% to 40%" });
});

test("a mistake below or inside its usual range gets no item", () => {
  const items = attentionItems(
    report({ mistakes: [mistake("below", today(0.01, "below")), mistake("usual", today(0.2, null))] }),
  );
  expect(items).toEqual([]);
});

test("a slipping proven rule needs attention, after mistakes above their range", () => {
  const items = attentionItems(
    report({
      mistakes: [mistake("above", today(0.9, "above"))],
      permanent: [
        { ...fixture.permanent[0], name: "slips", slipping: true, change: { value: 0.5, low: 0.1, high: 1 } },
      ],
    }),
  );
  expect(items.map((i) => i.title)).toEqual(["above", "slips"]);
  expect(items[1].detail).toBe("Rule no longer cuts this mistake · 10% more to 100% more");
});

test("a trial that finished in the last 7 days is news, green only when it works", () => {
  const finished = fixture.trials.find((t) => t.state === "finished");
  if (!finished) throw new Error("the fixture has a finished trial");
  const on = (day: string, verdict: "works" | "can't tell") => ({
    ...finished,
    verdict,
    looks: [{ look: 3, day, verdict, tasks_with: 40, tasks_without: 40 }],
  });
  const items = attentionItems(
    report({ trials: [on("2026-11-06", "works"), on("2026-11-12", "can't tell"), on("2026-11-05", "works")] }),
  );
  expect(items.map((i) => [i.tone, i.detail])).toEqual([
    ["good", "Trial finished: works"],
    ["neutral", "Trial finished: can't tell"],
  ]);
  expect(needsHim(items)).toBe(0);
});

test("the full fixture lists the mistake above its range, the slipping rule and the finished trial", () => {
  const items = attentionItems(fixture);
  expect(items.map((i) => i.tone)).toEqual(["bad", "bad", "good"]);
  expect(needsHim(items)).toBe(2);
});

test("the calm line names the report's day", () => {
  expect(calmLine("2026-11-12")).toBe(
    "Nothing needs attention. No mistake was above its usual range on 12 Nov and no proven rule is slipping.",
  );
});
