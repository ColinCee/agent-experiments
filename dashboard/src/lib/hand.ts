import type { Day } from "@/data/report";
import { percent, plural, signedPercent } from "./format";
import type { Row } from "./rows";
import { STATUS_WORDS } from "./status";

/** What "Copy for an agent" copies: the rule's result and the sessions behind its latest misses, as a request. */
export function handText(row: Row, day: Day): string {
  const subject = row.kind === "trial" ? row.trial : row.check;
  const what = row.kind === "trial" ? "experiment" : "active rule";
  const rate = (r: number | null) => (r === null ? "none counted" : percent(r));
  const lines = [
    `Find out why agents still make this mistake, and propose what would stop it: "${row.name}".`,
    "",
    `The ${what}'s result as of ${day}: ${STATUS_WORDS[row.status]}.`,
    `Mistake rate with the rule ${rate(subject.rate_with)} over ${plural(subject.tasks_with, "task")}, without it ${rate(subject.rate_without)} over ${plural(subject.tasks_without, "task")}.`,
  ];
  if (row.change) {
    lines.push(
      `Change in mistakes with the rule: ${signedPercent(row.change.value)} (90% range ${signedPercent(row.change.low)} to ${signedPercent(row.change.high)}).`,
    );
  }
  lines.push("");
  if (subject.misses.length === 0) {
    lines.push("No session in its tasks has missed yet, so check how the mistake is counted.");
  } else {
    lines.push("Sessions with its latest misses, newest first (read their transcripts):");
    for (const miss of subject.misses) {
      lines.push(`- ${miss.session} (${miss.day}, ${miss.side === "with" ? "with the rule" : "without it"})`);
    }
  }
  return lines.join("\n");
}
