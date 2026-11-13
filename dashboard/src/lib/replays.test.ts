import { expect, test } from "vitest";
import { fixture } from "@/data/fixture";
import { replayedLine, trustReason, trustWords } from "./replays";

const replay = fixture.replays[0];

test("a replay says when it ran and on how many moments", () => {
  expect(replayedLine({ ...replay, day: "2026-11-12", moments: 57 }, "2026-11-12")).toBe(
    "Replayed 12 Nov · 57 past moments",
  );
  expect(replayedLine({ ...replay, moments: 1 }, "2026-11-12")).toContain("· 1 past moment");
});

test("trust is explained by the real rate against the replay's", () => {
  expect(trustReason({ ...replay, real_rate: 0.25, replay_rate: 0.12 })).toBe(
    "Real agents made this mistake 25% of the time; the replay 12% under the same rules.",
  );
  expect(trustReason({ ...replay, real_rate: null })).toBe("No real rate to compare the replay with.");
});

test("an untrusted replay's result is headed as not reliable", () => {
  expect(trustWords({ ...replay, trusted: true })).toEqual({ badge: "Can be trusted", heading: "Result" });
  expect(trustWords({ ...replay, trusted: false })).toEqual({
    badge: "Can't be trusted",
    heading: "Result (not reliable)",
  });
});
