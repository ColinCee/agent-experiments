import { expect, test } from "vitest";
import { fixture } from "@/data/fixture";
import { replayResult } from "./replays";

const replay = fixture.replays[0];

test("an untrusted replay's row says so in red, whatever its verdict; green only when a trusted one works", () => {
  expect(replayResult({ ...replay, trusted: false, verdict: "works" })).toEqual({
    text: "Can't be trusted",
    tone: "bad",
  });
  expect(replayResult({ ...replay, trusted: true, verdict: "works" })).toEqual({ text: "Works", tone: "good" });
  expect(replayResult({ ...replay, trusted: true, verdict: "can't tell" })).toEqual({
    text: "Can't tell",
    tone: "unclear",
  });
});
