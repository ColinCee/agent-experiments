import type { Live } from "@/data/report";
import { percent } from "@/lib/format";
import type { Row } from "@/lib/rows";
import type { SkillRow } from "@/lib/skills";

function Count({ label, measured, total }: { label: string; measured: number; total: number }) {
  return (
    <div data-count={label} className="rounded-md bg-muted px-3 py-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-mono text-lg">
        {measured} of {total}
      </div>
      <div className="text-muted-foreground text-xs">measured, in the tables below</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
        <div className="h-full bg-foreground opacity-60" style={{ width: percent(total ? measured / total : 0) }} />
      </div>
    </div>
  );
}

/**
 * How much of what agents load is measured (PRODUCT.md, Behaviour): two counts, then the rule lines and skills nothing
 * measures, folded. The measured ones are the rows of the tables below, so they are not listed again.
 */
export function LiveNow({ live, rows, skills }: { live: Live; rows: Row[]; skills: SkillRow[] }) {
  const ruleRows = new Set(rows.map((row) => row.name));
  const skillRows = new Set(skills.map((row) => row.name));
  const isMeasured = (row: string | null, names: Set<string>) => row !== null && names.has(row);
  const rules = live.rules.filter((rule) => !isMeasured(rule.row, ruleRows));
  const loose = live.skills.filter((skill) => !isMeasured(skill.row, skillRows));
  const items = [
    ...rules.map((rule, i) => ({ key: `rule-${i}`, label: rule.label, title: rule.text, group: rule.group })),
    ...loose.map((skill) => ({ key: `skill-${skill.name}`, label: skill.name, title: skill.name, group: "Skills" })),
  ];
  return (
    <section aria-label="Live now" data-live className="grid gap-3 rounded-lg border p-3">
      <div className="grid grid-cols-2 gap-3">
        <Count label="Rule lines" measured={live.rules.length - rules.length} total={live.rules.length} />
        <Count label="Skills" measured={live.skills.length - loose.length} total={live.skills.length} />
      </div>
      <details data-list="Not measured" className="border-t pt-2">
        <summary className="cursor-pointer text-muted-foreground">Not measured ({items.length})</summary>
        <ul className="mt-1">
          {items.map((item, i) => (
            <li key={item.key} className="border-b py-1 last:border-b-0">
              {item.group !== items[i - 1]?.group && (
                <div className="pt-2 pb-1 text-muted-foreground text-xs">{item.group}</div>
              )}
              <span title={item.title}>{item.label}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
