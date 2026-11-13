import type { Replay } from "@/data/report";
import type { BadgeTone } from "./change";
import { verdictWords } from "./trials";

/** A replay's result in its row: "Can't be trusted" in red when it is not, else its verdict, green only when it works. */
export function replayResult(replay: Replay): { text: string; tone: BadgeTone } {
  if (!replay.trusted) return { text: "Can't be trusted", tone: "bad" };
  return { text: verdictWords(replay.verdict), tone: replay.verdict === "works" ? "good" : "unclear" };
}
