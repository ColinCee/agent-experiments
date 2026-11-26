import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { Day, StopVersion } from "@/data/report";
import { rateCeiling, rateTicks } from "@/lib/charts";
import { dayLabel, number } from "@/lib/format";
import { ChartTip } from "./chart-tip";

const per100 = (rate: number) => String(Math.round(rate * 100));

/** Needless stops per 100 under each version of the stop rules: one neutral line, since no version is a verdict. */
export function StopsChart({ versions, day }: { versions: StopVersion[]; day: Day }) {
  const shown = versions.filter((v) => v.rate !== null);
  const ceiling = rateCeiling(shown.map((v) => v.rate));
  const spoken = shown.map((v) => `${v.version}: ${per100(v.rate ?? 0)}`).join(", ");
  return (
    <figure className="m-0 grid gap-1 rounded-lg border p-3.5">
      <figcaption className="text-muted-foreground text-xs">Needless stops per 100 stops</figcaption>
      <div role="img" aria-label={`Needless stops per 100 stops, by rule version: ${spoken}`}>
        <ChartContainer className="aspect-auto h-[200px] w-full">
          <LineChart data={shown} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="version" tickLine={false} axisLine={false} interval={0} />
            <YAxis
              domain={[0, ceiling]}
              ticks={rateTicks(ceiling)}
              tickFormatter={per100}
              tickLine={false}
              axisLine={false}
              width={28}
              padding={{ top: 4, bottom: 4 }}
            />
            <ChartTooltip
              isAnimationActive={false}
              content={({ active, payload }) => {
                const v = payload?.[0]?.payload as StopVersion | undefined;
                return (
                  <ChartTip
                    title={v ? `${v.version}, from ${dayLabel(v.from, day)}` : ""}
                    note={v?.what}
                    rows={
                      active && v?.rate != null
                        ? [
                            { name: "Needless per 100", value: per100(v.rate) },
                            { name: "Stops", value: number(v.stops) },
                          ]
                        : []
                    }
                  />
                );
              }}
            />
            <Line
              dataKey="rate"
              stroke="var(--foreground)"
              strokeWidth={2}
              type="linear"
              isAnimationActive={false}
              dot={{ r: 3, fill: "var(--foreground)" }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      </div>
      <p className="text-center text-muted-foreground text-xs">Rule version</p>
    </figure>
  );
}
