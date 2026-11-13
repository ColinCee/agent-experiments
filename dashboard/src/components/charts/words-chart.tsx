import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { Day } from "@/data/report";
import { dayLabel, number } from "@/lib/format";
import { ChartTip } from "./chart-tip";

/** Words of a set of files by day, on its own scale from 0, in one neutral colour. */
export function WordsChart({ points, day }: { points: { day: Day; words: number }[]; day: Day }) {
  return (
    <ChartContainer className="aspect-auto h-[220px] w-full max-w-[560px] md:h-[260px]">
      <LineChart data={points} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
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
        />
      </LineChart>
    </ChartContainer>
  );
}
