import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { Trial } from "@/data/report";
import { rateCeiling, rateTicks } from "@/lib/charts";
import { percent } from "@/lib/format";
import { trendRows } from "@/lib/trials";
import { ChartTip } from "./chart-tip";
import { PointMark } from "./marks";

const SERIES = [
  { key: "without", name: "Without", stroke: "var(--without)", fill: "fill-without", swatch: "bg-without" },
  { key: "with", name: "With the rule", stroke: "var(--with)", fill: "fill-with", swatch: "bg-with" },
] as const;

/** A trial's mistake rate by day of the trial, with and without the rule, each line named at its end. */
export function TrendChart({ trial }: { trial: Trial }) {
  const rows = trendRows(trial);
  const ceiling = rateCeiling(rows.flatMap((r) => [r.with, r.without]));
  return (
    <ChartContainer className="aspect-auto h-[220px] w-full md:h-[260px]">
      <LineChart data={rows} margin={{ top: 12, right: 112, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis
          domain={[0, ceiling]}
          ticks={rateTicks(ceiling)}
          tickFormatter={percent}
          tickLine={false}
          axisLine={false}
          width={40}
          // Inner room so a 2px line at exactly 0% or 100% draws whole instead of being cut by the plot edge.
          padding={{ top: 4, bottom: 4 }}
        />
        <ChartTooltip
          isAnimationActive={false}
          content={({ active, payload, label }) => (
            <ChartTip
              title={String(label)}
              rows={
                active
                  ? SERIES.flatMap((s) => {
                      const rate = payload?.[0]?.payload?.[s.key];
                      return rate == null ? [] : [{ name: s.name, value: percent(rate), swatch: s.swatch }];
                    })
                  : []
              }
            />
          )}
        />
        {SERIES.map((s) => {
          const last = rows.findLastIndex((r) => r[s.key] !== null);
          return (
            <Line
              key={s.key}
              dataKey={s.key}
              stroke={s.stroke}
              strokeWidth={2}
              type="linear"
              connectNulls={false}
              isAnimationActive={false}
              dot={(props) => <PointMark key={props.index} {...props} series={s.key} />}
              activeDot={{ r: 4 }}
              label={({ x, y, index }: { x?: number | string; y?: number | string; index?: number }) =>
                index === last ? (
                  <text
                    key={s.key}
                    x={Number(x) + 10}
                    y={Number(y)}
                    dominantBaseline="middle"
                    className={`${s.fill} text-xs font-medium`}
                  >
                    {s.name}
                  </text>
                ) : (
                  <g key={index} />
                )
              }
            />
          );
        })}
      </LineChart>
    </ChartContainer>
  );
}
