import type { Live } from "@/data/report";
import { percent } from "@/lib/format";
import { rowHref } from "@/lib/hash";
import type { Row } from "@/lib/rows";
import type { SkillRow } from "@/lib/skills";
import { STATUS_WORDS } from "@/lib/status";
import { STATUS_TONE } from "./status-icon";

type Item = { key: string; label: string; title: string; side?: string; group?: string; tone?: string; href?: string };

function Count({ label, measured, total }: { label: string; measured: number; total: number }) {
  return (
    <div data-count={label} className="rounded-md bg-muted px-3 py-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-mono text-lg">
        {measured} of {total}
      </div>
      <div className="text-muted-foreground text-xs">measured</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
        <div className="h-full bg-foreground opacity-60" style={{ width: percent(total ? measured / total : 0) }} />
      </div>
    </div>
  );
}

function List({ name, items }: { name: string; items: Item[] }) {
  return (
    <details data-list={name} className="border-t py-2">
      <summary className="cursor-pointer text-muted-foreground">
        {name} ({items.length})
      </summary>
      <ul className="mt-1">
        {items.map((item, i) => (
          <li key={item.key} className="border-b py-1 last:border-b-0">
            {item.group && item.group !== items[i - 1]?.group && (
              <div className="pt-2 pb-1 text-muted-foreground text-xs">{item.group}</div>
            )}
            <div className="flex justify-between gap-4">
              <span title={item.title} className="min-w-0">
                {item.label}
              </span>
              {item.href ? (
                <a
                  href={item.href}
                  aria-label={`${item.label}: ${item.side}`}
                  className={`shrink-0 font-mono hover:underline ${item.tone ?? ""}`}
                >
                  {item.side}
                </a>
              ) : (
                item.side && (
                  <span className={`shrink-0 font-mono ${item.tone ?? "text-muted-foreground"}`}>{item.side}</span>
                )
              )}
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * How much of what agents load is measured (PRODUCT.md, Behaviour): two counts first, then every rule line and skill
 * folded into measured and not measured. A measured one links to its row.
 */
export function LiveNow({ live, rows, skills }: { live: Live; rows: Row[]; skills: SkillRow[] }) {
  const ruleRow = new Map(rows.map((row) => [row.name, row]));
  const skillRow = new Map(skills.map((row) => [row.name, row]));
  const measured: Item[] = [];
  const not: Item[] = [];
  for (const [i, rule] of live.rules.entries()) {
    const row = rule.row ? ruleRow.get(rule.row) : undefined;
    const item = { key: `rule-${i}`, label: rule.label, title: rule.text };
    if (row) {
      measured.push({ ...item, side: STATUS_WORDS[row.status], tone: STATUS_TONE[row.status], href: rowHref(row.id) });
    } else {
      not.push({ ...item, group: rule.group });
    }
  }
  for (const skill of live.skills) {
    const row = skill.row ? skillRow.get(skill.row) : undefined;
    const item = { key: `skill-${skill.name}`, label: skill.name, title: skill.name };
    if (row) {
      const rate = row.skill.now;
      const side = rate ? `${percent(rate.rate)} missed` : "no tasks yet";
      // A rate alone is no verdict (PRODUCT.md), so it takes no colour.
      measured.push({ ...item, side, tone: "text-muted-foreground", href: rowHref(row.id) });
    } else {
      not.push({ ...item, group: "Skills" });
    }
  }
  const measuredRules = live.rules.filter((rule) => rule.row && ruleRow.has(rule.row)).length;
  const measuredSkills = live.skills.filter((skill) => skill.row && skillRow.has(skill.row)).length;
  return (
    <section aria-label="Live now" data-live className="grid gap-3 rounded-lg border p-3">
      <div className="grid grid-cols-2 gap-3">
        <Count label="Rule lines" measured={measuredRules} total={live.rules.length} />
        <Count label="Skills" measured={measuredSkills} total={live.skills.length} />
      </div>
      <div>
        <List name="Measured" items={measured} />
        <List name="Not measured" items={not} />
      </div>
    </section>
  );
}
