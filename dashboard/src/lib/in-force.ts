import type { InForce, Mistake, Report } from "@/data/report";
import { slug } from "./rows";

/** Days with no use after which a rule or skill is a trim candidate (TRIM_DAYS in src/agent_experiments/rules.py). */
export const TRIM_DAYS = 30;

/** One row of the rules and skills in force. */
export type ForceRow = {
  id: string;
  /** The rule in plain words: no list or table marks, no code ticks. */
  name: string;
  item: InForce;
  /** Its mistakes, in the report's order of names; none when not measured. */
  mistakes: Mistake[];
  /** The mistake with the highest rate over the last 28 days. */
  worst: Mistake | null;
  /** A mistake's rate today is above its usual range. */
  high: boolean;
  /** Counted for TRIM_DAYS and never used. */
  trim: boolean;
  /** What its mistakes did since their rules' latest change; none when not measured. */
  evidence: Evidence;
};

/** A rules file line as plain words: "| When | Do |" reads "When: Do". */
export function plainRule(text: string): string {
  const cells = text.startsWith("|")
    ? text
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim())
    : [text.replace(/^- /, "")];
  return cells
    .join(": ")
    .replace(/\*\*|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const GROUPS: { kind: InForce["kind"]; title: string }[] = [
  { kind: "rule", title: "Every-turn rules" },
  { kind: "trial", title: "Rule changes' wording" },
  { kind: "skill", title: "Skills" },
];

/** Fewest tasks on each side of a change for its before and after to say anything (MIN_TASKS in verdicts.py). */
const MIN_TASKS = 8;

export type Evidence = "fewer" | "more" | "unclear" | "too few" | "none";

export const EVIDENCE_WORDS: Record<Evidence, string> = {
  fewer: "Fewer mistakes",
  more: "More mistakes",
  unclear: "No clear change",
  "too few": "Too few tasks",
  none: "No change dated",
};

/** What one mistake's rate did since its rule's latest change: not a verdict, since it moves every day. */
function since(m: Mistake): Evidence {
  if (!m.rule || !m.change) return "none";
  if ((m.before?.tasks ?? 0) < MIN_TASKS || (m.after?.tasks ?? 0) < MIN_TASKS) return "too few";
  if (!m.sure) return "unclear";
  return m.change.value < 0 ? "fewer" : "more";
}

/** A rule's evidence across its mistakes: more mistakes anywhere first, then fewer, then the rest. */
export function evidence(mistakes: Mistake[]): Evidence {
  const all = mistakes.map(since);
  return (["more", "fewer", "unclear", "too few", "none"] as const).find((e) => all.includes(e)) ?? "none";
}

/** A row needs him when a mistake is above its usual range today, or it went unused for TRIM_DAYS. */
export const needsHim = (row: ForceRow) => row.high || row.trim;

/** Every rule line and skill in force, in the report's order, with ids stable across reports while the text stays. */
export function forceRows(report: Report): ForceRow[] {
  const byName = new Map(report.mistakes.map((m) => [m.name, m]));
  const seen = new Set<string>();
  return (report.in_force ?? []).map((item) => {
    const name = item.kind === "skill" ? item.text : plainRule(item.text);
    let id = `${item.kind}-${slug(name)}`;
    for (let n = 2; seen.has(id); n++) id = `${item.kind}-${slug(name)}-${n}`;
    seen.add(id);
    const mistakes = item.measures.flatMap((m) => byName.get(m) ?? []);
    const worst = mistakes.reduce<Mistake | null>(
      (top, m) => ((m.recent?.rate ?? -1) > (top?.recent?.rate ?? -1) ? m : top),
      null,
    );
    return {
      id,
      name,
      item,
      mistakes,
      worst,
      high: mistakes.some((m) => m.today?.outside === "above"),
      trim: item.used === 0 && (item.window?.days ?? 0) >= TRIM_DAYS,
      evidence: evidence(mistakes),
    };
  });
}
