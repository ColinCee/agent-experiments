import { expect, test } from "vitest";
import { fixture } from "@/data/fixture";
import type { Mistake, Sizes } from "@/data/report";
import {
  daySpan,
  mistakeFacts,
  mistakeHeadline,
  mistakeLine,
  onlyAddedLine,
  permanentFacts,
  permanentHeadline,
  replayChangeAside,
  replayFacts,
  replayHeadline,
  sizeHeadline,
  trialFacts,
  trialHeadline,
  trialLine,
} from "./details";

const DAY = "2026-11-12";
const side = (rate: number, tasks: number, from: string) => ({ rate, low: null, high: null, tasks, from });
const mistake = (over: Partial<Mistake>): Mistake => ({ ...fixture.mistakes[0], ...over });

test("a short span of days names the month once", () => {
  expect(daySpan("2026-11-06", "2026-11-07", DAY)).toBe("6 to 7 Nov");
  expect(daySpan("2026-10-30", "2026-11-02", DAY)).toBe("30 Oct to 2 Nov");
  expect(daySpan("2026-11-04", "2026-11-04", DAY)).toBe("4 Nov");
});

test("a mistake's headline is its change against before the rule, coloured only when sure", () => {
  const sure = mistake({
    change: { value: -0.89, low: -1, high: -0.57 },
    before: side(0.24, 30, "2026-11-01"),
    after: side(0.03, 30, "2026-11-08"),
  });
  expect(mistakeHeadline(sure)).toEqual({ big: "89% fewer", rest: "than before the rule", tone: "good" });
  const unclear = { ...sure, change: { value: -0.2, low: -0.6, high: 0.3 } };
  expect(mistakeHeadline(unclear)).toEqual({ big: "Unclear", rest: "against before the rule", tone: "neutral" });
  const none = mistake({ rule: null, current: side(0.47, 156, "2026-10-16") });
  expect(mistakeHeadline(none)).toEqual({ big: "47% of tasks", rest: "no rule yet", tone: "neutral" });
});

test("a mistake's facts give each side with its tasks and window, today with a dot only outside usual, and the rule", () => {
  const m = mistake({
    rule: { day: "2026-11-08", what: "Do it right" },
    before: side(0.24, 17, "2026-11-06"),
    after: side(0.03, 15, "2026-11-08"),
    today: { rate: 0, usual_low: 0.01, usual_high: 0.55, outside: "below" },
  });
  expect(mistakeFacts(m, DAY)).toEqual([
    { label: "Before the rule", value: "24% (17 tasks, 6 to 7 Nov)" },
    { label: "After the rule", value: "3% (15 tasks, from 8 Nov)" },
    { label: "Today", value: "0%, usually 1% to 55%", dot: "good" },
    { label: "Rule", value: "Do it right" },
  ]);
  const few = { ...m, before: side(0.24, 7, "2026-11-06"), today: null };
  expect(mistakeFacts(few, DAY).at(-1)).toEqual({ label: "Note", value: "only 7 tasks before" });
  expect(mistakeFacts({ ...m, today: { rate: 0.2, usual_low: 0.1, usual_high: 0.3, outside: null } }, DAY)[2]).toEqual({
    label: "Today",
    value: "20%, usually 10% to 30%",
  });
  expect(mistakeLine(m, DAY)).toBe("How often this mistake happened, before and after the rule changed on 8 Nov.");
});

test("a trial's headline says when it starts, its day and result so far, or its verdict", () => {
  const [scheduled, running, finished] = fixture.trials;
  expect(trialHeadline(scheduled, DAY)).toEqual({ big: "Starts 13 Nov", rest: null, tone: "neutral" });
  expect(trialHeadline(running, DAY)).toEqual({ big: "Day 4 of 7", rest: "unclear so far", tone: "neutral" });
  expect(trialHeadline(finished, DAY)).toEqual({ big: "Works", rest: null, tone: "good" });
  expect(trialLine(running)).toBe("Half of tasks run with the rule and half without, for 7 days.");
});

test("a trial's facts give its dates and pace, and the outlook only while a slow one can still miss", () => {
  const [, running, finished] = fixture.trials;
  expect(trialFacts({ ...running, per_week: 20, needed: 80 }, DAY)).toEqual([
    { label: "Starts", value: "9 Nov" },
    { label: "Ends", value: "16 Nov" },
    { label: "Usual pace", value: "about 20 tasks each way per week" },
    { label: "Outlook", value: "May end unclear: needs about 80" },
  ]);
  expect(trialFacts({ ...running, per_week: 200 }, DAY).map((f) => f.label)).not.toContain("Outlook");
  expect(trialFacts({ ...finished, per_week: 20 }, DAY).map((f) => f.label)).not.toContain("Outlook");
});

test("a proven rule's headline is its status, coloured green or red only when it works or slips", () => {
  const [working, waiting] = fixture.permanent;
  const slipping = fixture.permanent.find((p) => p.slipping);
  expect(permanentHeadline(working)).toMatchObject({ big: "Still working", tone: "good" });
  expect(permanentHeadline(waiting)).toMatchObject({ big: "Waiting for tasks", tone: "neutral" });
  expect(slipping && permanentHeadline(slipping)).toMatchObject({ big: "Slipping", tone: "bad" });
  expect(permanentFacts({ ...waiting, model: null }, DAY).map((f) => f.label)).toEqual([
    "Checked since",
    "Tasks without the rule",
    "Tasks with the rule",
  ]);
});

test("an untrusted replay's headline says only that, outlined, and its change is an aside about the replay", () => {
  const untrusted = { ...fixture.replays[0], trusted: false, change: { value: -0.72, low: -0.9, high: -0.5 } };
  expect(replayHeadline(untrusted)).toEqual({ big: "Can't be trusted", rest: null, tone: "bad", outlined: true });
  expect(replayChangeAside(untrusted)).toBe("72% fewer in the replay");
  expect(replayHeadline(fixture.replays[0])).toMatchObject({ big: "Works", tone: "good", outlined: false });
  expect(replayFacts({ ...fixture.replays[0], real_rate: 0.3, replay_rate: 0.1 }, DAY)[0]).toEqual({
    label: "Check",
    value: "Real agents 30% · replay 10% under the same rules",
  });
});

test("a size's headline is its words now, up, down or the same as its first day's", () => {
  const series = (first: number, now: number): Sizes["series"][number] => ({
    label: "Rules",
    now,
    points: [
      { day: "2026-10-14", words: first },
      { day: DAY, words: now },
    ],
  });
  expect(sizeHeadline(series(769, 1804), DAY)).toEqual({
    big: "1,804 words",
    rest: "up from 769 on 14 Oct",
    tone: "neutral",
  });
  expect(sizeHeadline(series(900, 700), DAY).rest).toBe("down from 900 on 14 Oct");
  expect(sizeHeadline(series(700, 700), DAY).rest).toBe("same as 700 on 14 Oct");
  expect(
    onlyAddedLine({ month: "2026-10", label: "Rules", changes: 21, only_added: 1 / 3, added_share: 0.6 }, DAY),
  ).toBe("Oct · 33% · 7 of 21");
});
