import { ChevronLeft } from "lucide-react";
import type { Day } from "@/data/report";
import { dayLabel, number, percent } from "@/lib/format";
import { rowHref } from "@/lib/hash";
import { type SkillRow, skillChart, skillHandText } from "@/lib/skills";
import { MISSED, TrendChart } from "./charts/trend-chart";
import { CopyButton } from "./copy-button";
import { Facts, Section } from "./rule-card";
import { RateBand } from "./skill-table";

/** One skill in full: how often it is missed, over time with each new version marked, and by version. */
export function SkillCard({ row, day }: { row: SkillRow; day: Day }) {
  const { skill } = row;
  const { now } = skill;
  const chart = skillChart(skill, day);
  const drawn = chart.rows.filter((r) => r.with !== null).length > 1;
  return (
    <div
      data-detail={row.id}
      className="grid gap-5 p-4.5 motion-safe:fade-in motion-safe:animate-in motion-safe:duration-150"
    >
      <a
        href={rowHref(null)}
        className="-my-1 flex min-h-8 items-center gap-1 text-muted-foreground text-xs min-[1100px]:hidden"
      >
        <ChevronLeft aria-hidden className="size-3.5" />
        All rules
      </a>
      <section data-section="verdict">
        <h2 className="text-balance font-semibold text-[0.9375rem]">{row.name}</h2>
        <p data-verdict className="mt-0.5 text-muted-foreground">
          {now ? `Missed ${percent(now.rate)} of the time` : "No task needed it in the last 28 days"}
        </p>
      </section>
      {now && (
        <Section id="rate-now" title="How often it is missed">
          {/* Beside the table the row already gives the number; alone on a phone the card has to. */}
          <p className="font-medium font-mono text-base min-[1100px]:hidden">{percent(now.rate)}</p>
          <RateBand side={now} large />
          <Facts
            facts={[
              ["Lowest likely", now.low === null ? "–" : percent(now.low)],
              ["Highest likely", now.high === null ? "–" : percent(now.high)],
              ["Tasks that needed it", number(now.tasks)],
              [skill.skills.length > 1 ? "Skill, by every name it had" : "Skill", skill.skills.join(", ")],
            ]}
          />
        </Section>
      )}
      {drawn && (
        <Section id="rate" title="Missed over time">
          <TrendChart rows={chart.rows} ticks={chart.ticks} marks={chart.marks} series={MISSED} />
        </Section>
      )}
      {skill.versions.length > 0 && (
        <Section id="versions" title="By version">
          <table data-versions className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1.5 text-left font-normal">Version</th>
                <th className="py-1.5 text-left font-normal">From</th>
                <th className="py-1.5 text-right font-normal">Tasks</th>
                <th className="py-1.5 text-right font-normal">Missed</th>
              </tr>
            </thead>
            <tbody>
              {skill.versions.map((v) => (
                <tr key={v.version} data-version={v.version} className="border-t">
                  <td className="py-1.5 font-mono">{v.version}</td>
                  <td className="py-1.5">{dayLabel(v.since, day)}</td>
                  <td className="py-1.5 text-right font-mono">{number(v.tasks)}</td>
                  <td className="py-1.5 text-right font-mono">
                    {v.rate === null ? (
                      <span className="whitespace-nowrap text-muted-foreground">too few</span>
                    ) : (
                      percent(v.rate)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
      {now && (
        <Section id="hand" title="Hand to an agent">
          {skill.misses.length > 0 && (
            <div data-misses>
              <p className="mb-1 text-muted-foreground text-xs">Latest misses</p>
              <Facts facts={skill.misses.map((miss) => [dayLabel(miss.day, day), miss.session, miss.session])} />
            </div>
          )}
          <CopyButton text={() => skillHandText(row, day)}>Copy for an agent</CopyButton>
        </Section>
      )}
    </div>
  );
}
