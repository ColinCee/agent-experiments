import type { Day, Replay } from "@/data/report";
import type { BadgeTone } from "./change";
import { dayLabel, percent, plural } from "./format";
import { verdictWords } from "./trials";

/** "Replayed 12 Nov · 191 moments". */
export function replayedLine(replay: Replay, day: Day): string {
  return `Replayed ${dayLabel(replay.day, day)} · ${plural(replay.moments, "past moment")}`;
}

/** Why the replay can or can't be trusted: the real rate against the replay's under the same rules. */
export function trustReason(replay: Replay): string {
  if (replay.real_rate === null || replay.replay_rate === null) return "No real rate to compare the replay with.";
  return `Real agents made this mistake ${percent(replay.real_rate)} of the time; the replay ${percent(replay.replay_rate)} under the same rules.`;
}

/** The trust badge and the heading of the result it vouches for. */
export function trustWords(replay: Replay): { badge: string; heading: string } {
  return replay.trusted
    ? { badge: "Can be trusted", heading: "Result" }
    : { badge: "Can't be trusted", heading: "Result (not reliable)" };
}

/** A replay's result in its row: "Can't be trusted" in red when it is not, else its verdict, green only when it works. */
export function replayResult(replay: Replay): { text: string; tone: BadgeTone } {
  if (!replay.trusted) return { text: "Can't be trusted", tone: "bad" };
  return { text: verdictWords(replay.verdict), tone: replay.verdict === "works" ? "good" : "unclear" };
}
