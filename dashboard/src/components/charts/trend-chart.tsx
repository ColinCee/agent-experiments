import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { rateCeiling, rateTicks, type TrendRow } from "@/lib/charts";
import { percent } from "@/lib/format";
import { ChartTip } from "./chart-tip";
import { PointMark } from "./marks";

type Series = { key: "with" | "without"; name: string; stroke: string; fill: string; swatch: string };

const SIDES: Series[] = [
  { key: "without", name: "Without", stroke: "var(--without)", fill: "fill-without", swatch: "bg-without" },
  { key: "with", name: "With rule", stroke: "var(--with)", fill: "fill-with", swatch: "bg-with" },
];

/** A skill's one line: a rate with nothing to compare it with, so no result colour. */
export const MISSED: Series[] = [
  { key: "with", name: "Missed", stroke: "var(--foreground)", fill: "fill-foreground", swatch: "bg-foreground" },
];

/**
 * A mistake rate by day, with and without the rule (or the lines in `series`), each line named at its end and each
 * day in `marks` drawn as a dashed line. `ticks` are the labels the day axis names; every label when left out.
 */
export function TrendChart({
  rows,
  marks = [],
  ticks,
  tickFormatter,
  series = SIDES,
}: {
  rows: TrendRow[];
  series?: Series[];
  marks?: string[];
  ticks?: string[];
  tickFormatter?: (label: string, index: number) => string;
}) {
  const ceiling = rateCeiling(rows.flatMap((r) => [r.with, r.without]));
  return (
    <ChartContainer className="aspect-auto h-[180px] w-full">
      <LineChart data={rows} margin={{ top: 8, right: 72, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          interval={0}
          ticks={ticks}
          tickFormatter={tickFormatter}
        />
        <YAxis
          domain={[0, ceiling]}
          ticks={rateTicks(ceiling)}
          tickFormatter={percent}
          tickLine={false}
          axisLine={false}
          width={36}
          // Inner room so a 2px line at exactly 0% or 100% draws whole instead of being cut by the plot edge.
          padding={{ top: 4, bottom: 4 }}
        />
        {marks.map((label) => (
          <ReferenceLine key={label} x={label} stroke="var(--ring)" strokeDasharray="2 3" />
        ))}
        <ChartTooltip
          isAnimationActive={false}
          content={({ active, payload, label }) => (
            <ChartTip
              title={String(label)}
              rows={
                active
                  ? series.flatMap((s) => {
                      const rate = payload?.[0]?.payload?.[s.key];
                      return rate == null ? [] : [{ name: s.name, value: percent(rate), swatch: s.swatch }];
                    })
                  : []
              }
            />
          )}
        />
        {series.map((s) => {
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
