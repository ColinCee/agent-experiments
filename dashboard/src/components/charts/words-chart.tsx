import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { Day } from "@/data/report";
import { dayLabel, number } from "@/lib/format";
import { ChartTip } from "./chart-tip";

/** Words of a set of files by day, on its own scale from 0, in one neutral colour, its first and last day's words written on it. */
export function WordsChart({ points, day }: { points: { day: Day; words: number }[]; day: Day }) {
  const last = points.length - 1;
  return (
    <ChartContainer className="aspect-auto h-[220px] w-full max-w-[560px] md:h-[260px]">
      <LineChart data={points} margin={{ top: 24, right: 52, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="day"
          tickFormatter={(d: Day) => dayLabel(d, day)}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={40}
        />
        <YAxis domain={[0, "auto"]} tickCount={4} tickFormatter={number} tickLine={false} axisLine={false} width={56} />
        <ChartTooltip
          isAnimationActive={false}
          content={({ active, payload, label }) =>
            active && payload?.[0] ? (
              <ChartTip
                title={dayLabel(String(label), day)}
                rows={[{ name: "Words", value: number(Number(payload[0].value)) }]}
              />
            ) : null
          }
        />
        <Line
          dataKey="words"
          stroke="var(--foreground)"
          strokeWidth={2}
          type="linear"
          dot={false}
          isAnimationActive={false}
          label={({ x, y, index }: { x?: number | string; y?: number | string; index?: number }) =>
            index === 0 || index === last ? (
              // The first value above its point, the latest beside its own, each with a halo so the line never
              // runs through the figures.
              <text
                key={index}
                data-end-label
                x={index === 0 ? Number(x) : Number(x) + 6}
                y={index === 0 ? Number(y) - 10 : Number(y)}
                textAnchor="start"
                dominantBaseline={index === 0 ? "auto" : "middle"}
                paintOrder="stroke"
                className="fill-foreground stroke-background text-xs font-medium"
                strokeWidth={4}
                strokeLinejoin="round"
              >
                {number(points[index ?? 0].words)}
              </text>
            ) : (
              <g key={index} />
            )
          }
        />
      </LineChart>
    </ChartContainer>
  );
}
