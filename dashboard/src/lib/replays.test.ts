import { expect, test } from "vitest";
import { fixture } from "@/data/fixture";
import { replayedLine, trustReason } from "./replays";

const replay = fixture.replays[0];

test("a replay says when it ran and on how many moments", () => {
  expect(replayedLine({ ...replay, day: "2026-11-12", moments: 191 }, "2026-11-12")).toBe(
    "Replayed 12 Nov · 191 moments",
  );
});

test("trust is explained by the real rate against the replay's", () => {
  expect(trustReason({ ...replay, real_rate: 0.3, replay_rate: 0.1 })).toBe(
    "Real agents made this mistake 30% of the time; the replay 10% under the same rules.",
  );
  expect(trustReason({ ...replay, real_rate: null })).toBe("No real rate to compare the replay with.");
});
