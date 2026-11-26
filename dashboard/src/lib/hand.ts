import type { Day, Side } from "@/data/report";
import { percent, plural, signedPercent } from "./format";
import type { Row } from "./rows";
import { STATUS_WORDS } from "./status";

/** What "Copy for an agent" copies: the change's result and the sessions behind its latest misses, as a request. */
export function handText(row: Row, day: Day): string {
  const { trial } = row;
  const side = (s: Side | null) => (s === null ? "none counted" : `${percent(s.rate)} over ${plural(s.tasks, "task")}`);
  const lines = [
    `Find out why agents still make this mistake, and propose what would stop it: "${row.name}".`,
    "",
    `The rule change of ${trial.started}, as of ${day}: ${STATUS_WORDS[row.status]}.`,
    `Mistake rate before the change ${side(trial.before)}, since it ${side(trial.after)}.`,
  ];
  if (row.change) {
    lines.push(
      `Change in mistakes: ${signedPercent(row.change.value)} (90% range ${signedPercent(row.change.low)} to ${signedPercent(row.change.high)}).`,
    );
  }
  lines.push("");
  if (trial.misses.length === 0) {
    lines.push("No session has missed since the change, so check how the mistake is counted.");
  } else {
    lines.push("Sessions with its latest misses since the change, newest first (read their transcripts):");
    for (const miss of trial.misses) lines.push(`- ${miss.session} (${miss.day})`);
  }
  return lines.join("\n");
}
