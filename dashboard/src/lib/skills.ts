import type { Day, Report, Skill } from "@/data/report";
import type { TrendRow } from "./charts";
import { dayLabel, percent, plural } from "./format";
import { slug } from "./rows";

/** One row of the skills table. */
export type SkillRow = { id: string; name: string; skill: Skill };

/** Skills missed most first, those with no tasks yet last; ids are stable across reports, so a link can name one. */
export function skillRows(report: Report): SkillRow[] {
  return report.skills
    .map((skill) => ({ id: `skill-${slug(skill.name)}`, name: skill.name, skill }))
    .toSorted((a, b) => (b.skill.now?.rate ?? -1) - (a.skill.now?.rate ?? -1));
}

/**
 * A skill's chart: its rate in the one line, a day a row labelled by its date, every 14th label back from the last on
 * the axis, and a mark on each day a new version was first loaded.
 */
export function skillChart(skill: Skill, reportDay: Day): { rows: TrendRow[]; ticks: string[]; marks: string[] } {
  const rows = skill.series.map((s) => ({ label: dayLabel(s.day, reportDay), with: s.rate, without: null }));
  const labels = new Set(rows.map((r) => r.label));
  return {
    rows,
    ticks: rows.filter((_, i) => (rows.length - 1 - i) % 14 === 0).map((r) => r.label),
    marks: [...new Set(skill.versions.map((v) => dayLabel(v.since, reportDay)))].filter((label) => labels.has(label)),
  };
}

/** What "Copy for an agent" copies for a skill: how often it is missed and its latest misses, as a request. */
export function skillHandText(row: SkillRow, day: Day): string {
  const { skill } = row;
  const lines = [
    `Find out why agents don't load the skill ${skill.skills.join(" or ")} when they should, and propose what would make them: "${row.name}".`,
    "",
    skill.now
      ? `As of ${day}, missed ${percent(skill.now.rate)} of the time over ${plural(skill.now.tasks, "task")} in the last 28 days.`
      : `As of ${day}, no task in the last 28 days called for it.`,
  ];
  const latest = skill.versions[0];
  if (latest) lines.push(`Its latest version, ${latest.version}, was first loaded on ${latest.since}.`);
  lines.push("");
  if (skill.misses.length === 0) {
    lines.push("No session has missed it in the last 28 days.");
  } else {
    lines.push("Sessions with its latest misses, newest first (read their transcripts):");
    for (const miss of skill.misses) lines.push(`- ${miss.session} (${miss.day})`);
  }
  return lines.join("\n");
}
