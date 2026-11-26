import { ChevronLeft } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import type { Day, Mistake } from "@/data/report";
import { rateCeiling, rateTicks } from "@/lib/charts";
import { dayLabel, number, percent, plural } from "@/lib/format";
import { rowHref } from "@/lib/hash";
import type { ForceRow } from "@/lib/in-force";
import { ChartTip } from "./charts/chart-tip";
import { Facts, Section } from "./rule-card";
import { ChartContainer, ChartTooltip } from "./ui/chart";

const USE_WORDS = { rule: "Chances to break it", trial: "Chances to break it", skill: "Loads" };

/** A mistake's 3-day rate over 6 weeks, with a solid line at each rule change and a dashed one at each model switch. */
function History({ mistake, day }: { mistake: Mistake; day: Day }) {
  const top = rateCeiling(mistake.series.map((p) => p.rate));
  return (
    <ChartContainer className="aspect-[2/1] w-full" data-history>
      <LineChart data={mistake.series} margin={{ top: 8, right: 8, bottom: 14, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="day"
          tickFormatter={(d: Day) => dayLabel(d, day)}
          tickLine={false}
          minTickGap={24}
          label={{ value: "Day", position: "insideBottom", offset: -10, className: "fill-muted-foreground" }}
        />
        <YAxis
          domain={[0, top]}
          ticks={rateTicks(top)}
          tickFormatter={percent}
          tickLine={false}
          axisLine={false}
          width={52}
          label={{ value: "% missed", angle: -90, position: "insideLeft", className: "fill-muted-foreground" }}
        />
        {mistake.changes
          .filter((c) => c.kind !== "trial")
          .map((c) => (
            <ReferenceLine
              key={`${c.kind}-${c.day}-${c.what}`}
              x={c.day}
              stroke="var(--muted-foreground)"
              strokeDasharray={c.kind === "model" ? "3 3" : undefined}
            />
          ))}
        <ChartTooltip
          content={({ active, payload }) => {
            const point = active ? payload?.[0]?.payload : null;
            if (!point) return null;
            const marks = mistake.changes.filter((c) => c.day === point.day && c.kind !== "trial");
            return (
              <ChartTip
                title={dayLabel(point.day, day)}
                rows={[
                  { name: "Missed, 3 days", value: point.rate === null ? "–" : percent(point.rate) },
                  ...marks.map((c) => ({ name: c.kind === "model" ? "Model now" : "Rule change", value: c.what })),
                ]}
              />
            );
          }}
        />
        <Line dataKey="rate" stroke="var(--foreground)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
      </LineChart>
    </ChartContainer>
  );
}

function MistakeFacts({ mistake, day }: { mistake: Mistake; day: Day }) {
  const { recent, today } = mistake;
  return (
    <Facts
      facts={[
        ["Missed, last 28 days", recent ? `${percent(recent.rate)} of ${plural(recent.tasks, "task")}` : "No chances"],
        [
          `Missed on ${dayLabel(day, day)}`,
          today
            ? `${percent(today.rate)}, usual ${percent(today.usual_low)} to ${percent(today.usual_high)}`
            : "Too few tasks",
        ],
      ]}
    />
  );
}

/** One rule line or skill in force in full: its use, then each mistake that counts it with its history. */
export function InForceCard({ row, day }: { row: ForceRow; day: Day }) {
  const { item } = row;
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
        All rules and skills
      </a>
      <section data-section="rule">
        <h2 className="text-pretty font-semibold text-[0.9375rem]">{row.name}</h2>
        <p className="mt-1 text-muted-foreground text-xs">{item.file}</p>
      </section>
      <Section id="use" title="Use">
        <Facts
          facts={[
            [
              USE_WORDS[item.kind],
              item.used === null || !item.window
                ? "Not counted"
                : `${number(item.used)} in ${plural(item.window.days, "day")} from ${dayLabel(item.window.from, day)}`,
            ],
            ...(row.trim ? [["Trim candidate", "Not used in 30 days"] as [string, string]] : []),
          ]}
        />
      </Section>
      {row.mistakes.length === 0 ? (
        <Section id="mistakes" title="Mistakes">
          <p className="text-muted-foreground text-xs">Nothing counts this rule's mistake yet.</p>
        </Section>
      ) : (
        row.mistakes.map((mistake) => (
          <Section key={mistake.name} id="mistake" title={mistake.name}>
            <MistakeFacts mistake={mistake} day={day} />
            <History mistake={mistake} day={day} />
          </Section>
        ))
      )}
    </div>
  );
}
