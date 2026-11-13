import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { Day, Mistake } from "@/data/report";
import { dayLabel, percent } from "@/lib/format";
import { historyRows } from "@/lib/mistakes";
import { ChartTip } from "./chart-tip";
import { PERCENT_TICKS, PointMark } from "./marks";

type Change = Mistake["changes"][number];

interface MarkerProps {
  x1?: number;
  y1?: number;
  y2?: number;
}

function Marker({
  x1 = 0,
  y1 = 0,
  y2 = 0,
  change,
  day,
  active,
  onPick,
}: MarkerProps & { change: Change; day: Day; active: boolean; onPick: (change: Change | null) => void }) {
  const top = Math.min(y1, y2);
  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG has no button element; the marker is drawn inside the chart.
    <g
      data-marker-day={change.day}
      role="button"
      tabIndex={0}
      aria-label={`What changed on ${dayLabel(change.day, day)}`}
      className="cursor-pointer outline-none"
      onMouseEnter={() => onPick(change)}
      onMouseLeave={() => onPick(null)}
      onFocus={() => onPick(change)}
      onBlur={() => onPick(null)}
      onClick={() => onPick(active ? null : change)}
      onKeyDown={(e) => e.key === "Enter" && onPick(active ? null : change)}
    >
      <line
        x1={x1}
        x2={x1}
        y1={y1}
        y2={y2}
        className={active ? "stroke-foreground" : "stroke-muted-foreground"}
        strokeDasharray="4 3"
      />
      {/* A wide invisible line, so the marker is easy to hover and tap. */}
      <line x1={x1} x2={x1} y1={top - 16} y2={Math.max(y1, y2)} stroke="transparent" strokeWidth={16} />
      <text x={x1} y={top - 6} textAnchor="middle" className="fill-muted-foreground text-xs">
        {dayLabel(change.day, day)}
      </text>
    </g>
  );
}

/**
 * A mistake's daily share over the window: grey up to its latest rule change, blue from it, with a dashed marker at
 * every rule change. Hovering or tapping a marker calls `onPick` with it, so the card can say what changed.
 */
export function HistoryChart({
  mistake,
  day,
  picked,
  onPick,
}: {
  mistake: Mistake;
  day: Day;
  picked: Change | null;
  onPick: (change: Change | null) => void;
}) {
  const rows = historyRows(mistake);
  return (
    <ChartContainer className="aspect-auto h-[220px] w-full md:h-[260px]">
      <LineChart data={rows} margin={{ top: 24, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="day"
          tickFormatter={(d: Day) => dayLabel(d, day)}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={40}
        />
        <YAxis
          domain={[0, 1]}
          ticks={PERCENT_TICKS}
          tickFormatter={percent}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <ChartTooltip
          isAnimationActive={false}
          content={({ active, payload, label }) => {
            const row = active ? payload?.[0]?.payload : undefined;
            const rate = row?.after ?? row?.before;
            if (rate == null) return null;
            const since = row.after != null && mistake.rule !== null;
            return (
              <ChartTip
                title={dayLabel(String(label), day)}
                rows={[
                  {
                    name: since ? "Since rule" : "Share",
                    value: percent(rate),
                    swatch: since ? "bg-with" : "bg-without",
                  },
                ]}
              />
            );
          }}
        />
        {mistake.changes.map((change) => (
          <ReferenceLine
            key={`${change.day} ${change.what}`}
            x={change.day}
            shape={(props: MarkerProps) => (
              <Marker {...props} change={change} day={day} active={picked === change} onPick={onPick} />
            )}
          />
        ))}
        {(["before", "after"] as const).map((key) => (
          <Line
            key={key}
            dataKey={key}
            stroke={key === "after" ? "var(--with)" : "var(--without)"}
            strokeWidth={2}
            type="linear"
            connectNulls={false}
            isAnimationActive={false}
            dot={(props) => <PointMark key={props.index} {...props} series={key} />}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
