import { FlaskConical } from "lucide-react";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, usePlotArea, useXAxisScale, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import type { Day, Mistake, MistakeChange } from "@/data/report";
import { layoutLabels, rateCeiling, rateTicks } from "@/lib/charts";
import { dayLabel, percent } from "@/lib/format";
import { changesByDay, historyBands, historyRows, markerWords } from "@/lib/mistakes";
import { cn } from "@/lib/utils";
import { textWidth } from "../measure";
import { ChartTip } from "./chart-tip";
import { PointMark } from "./marks";

const LABEL_FONT = 12;
const ICON = 12;
const ROW_HEIGHT = 16;

/**
 * Blue since the latest rule, grey over exactly the window the before rate covers, and earlier history thin and light
 * so it reads as context, not as "before" (it may fall under 3:1; the bands carry the meaning).
 */
const SERIES_STYLE = {
  earlier: { stroke: "var(--muted-foreground)", strokeOpacity: 0.45, strokeWidth: 1 },
  before: { stroke: "var(--without)", strokeWidth: 2 },
  after: { stroke: "var(--with)", strokeWidth: 2 },
} as const;

export interface Picked {
  day: Day;
  changes: MistakeChange[];
  x: number;
  anchor: "start" | "middle" | "end";
}

/**
 * A dashed line at every rule change and a lighter dotted one, with a flask, at every trial start, each dated above the
 * plot. Drawn inside the chart from its own x scale, so a marker sits exactly on its day's point.
 */
function Markers({
  changes,
  day,
  picked,
  onPick,
}: {
  changes: MistakeChange[];
  day: Day;
  picked: Day | null;
  onPick: (picked: Picked | null) => void;
}) {
  const scale = useXAxisScale();
  const plot = usePlotArea();
  if (!scale || !plot) return null;
  const marks = changesByDay(changes).flatMap((group) => {
    const x = scale(group.day);
    if (x === undefined) return [];
    // A day with a rule change is drawn as a rule change; only a day of trial starts alone gets the trial style.
    const trial = group.changes.every((c) => c.kind === "trial");
    const label = dayLabel(group.day, day);
    const width = textWidth(label, LABEL_FONT) + (trial ? ICON + 2 : 0);
    return [{ group, trial, x, label, width }];
  });
  const slots = layoutLabels(marks, plot.x, plot.x + plot.width);
  const third = plot.width / 3;
  return (
    <g>
      {marks.map(({ group, trial, x, label, width }, i) => {
        const { row, anchor } = slots[i];
        const active = picked === group.day;
        const pick = () =>
          onPick({ ...group, x, anchor: x < plot.x + third ? "start" : x > plot.x + 2 * third ? "end" : "middle" });
        const from = anchor === "start" ? x : anchor === "end" ? x - width : x - width / 2;
        const y = plot.y - 6 - (row ?? 0) * ROW_HEIGHT;
        return (
          // biome-ignore lint/a11y/useSemanticElements: SVG has no button element; the marker is drawn inside the chart.
          <g
            key={group.day}
            data-marker-day={group.day}
            data-marker-kind={trial ? "trial" : "rule"}
            role="button"
            tabIndex={0}
            aria-label={group.changes.map((c) => markerWords(c, day)).join("; ")}
            className="cursor-pointer outline-none"
            // Hover only for a real mouse: after a tap, browsers may send compatibility mouse events (a mouseout on
            // Linux Chrome) that would close the tip the tap just opened. Taps open it through click.
            onPointerEnter={(e) => e.pointerType === "mouse" && pick()}
            onPointerLeave={(e) => e.pointerType === "mouse" && onPick(null)}
            onFocus={pick}
            onBlur={() => onPick(null)}
            onClick={pick}
            onKeyDown={(e) => e.key === "Enter" && pick()}
          >
            <line
              x1={x}
              x2={x}
              y1={plot.y}
              y2={plot.y + plot.height}
              className={cn(trial ? "stroke-muted-foreground" : "stroke-foreground/70", active && "stroke-foreground")}
              strokeDasharray={trial ? "1 3" : "4 3"}
              strokeLinecap={trial ? "round" : undefined}
              strokeWidth={trial ? 1.5 : 1}
            />
            {/* A wide invisible line, so the marker is easy to hover and tap. */}
            <line x1={x} x2={x} y1={plot.y - 30} y2={plot.y + plot.height} stroke="transparent" strokeWidth={16} />
            {row !== null && (
              <g data-marker-label className={trial ? "fill-muted-foreground" : "fill-foreground"}>
                {trial && (
                  <FlaskConical
                    x={from}
                    y={y - ICON + 2}
                    width={ICON}
                    height={ICON}
                    className="stroke-muted-foreground"
                    fill="none"
                  />
                )}
                <text x={trial ? from + ICON + 2 : from} y={y} className="text-xs">
                  {label}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Soft grey and blue bands behind the compared windows, so they show at a glance and not only by line shade. */
function Bands({ mistake }: { mistake: Mistake }) {
  const scale = useXAxisScale();
  const plot = usePlotArea();
  if (!scale || !plot) return null;
  return (
    <g>
      {historyBands(mistake).map(({ kind, from, to }) => {
        const [x1, x2] = [scale(from), scale(to)];
        if (x1 === undefined || x2 === undefined) return null;
        return (
          <rect
            key={kind}
            data-band={kind}
            x={x1}
            y={plot.y}
            width={x2 - x1}
            height={plot.height}
            className={kind === "after" ? "fill-with/10" : "fill-without/10"}
          />
        );
      })}
    </g>
  );
}

/** What a hovered or tapped marker says, in a small box at the top of the chart near it. */
function MarkerTip({ picked, day }: { picked: Picked; day: Day }) {
  return (
    <div
      data-marker-tip
      className={cn(
        "pointer-events-none absolute top-1 max-w-64 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground",
        picked.anchor === "middle" && "-translate-x-1/2",
        picked.anchor === "end" && "-translate-x-full",
      )}
      style={{ left: picked.x }}
    >
      {picked.changes.map((c) => (
        <p key={`${c.kind} ${c.what}`}>{markerWords(c, day)}</p>
      ))}
    </div>
  );
}

/**
 * A mistake's daily share over the window: grey up to its latest rule change, blue from it, with a marker at every rule
 * change and trial start (one per day). Its axis tops out at 20%, 50% or 100%, whichever the data fits.
 */
export function HistoryChart({ mistake, day }: { mistake: Mistake; day: Day }) {
  const [picked, setPicked] = useState<Picked | null>(null);
  const rows = historyRows(mistake);
  const ceiling = rateCeiling(mistake.series.map((p) => p.rate));
  const twoRows = new Set(mistake.changes.map((c) => c.day)).size > 1;
  return (
    // Capped so a wide card or panel never stretches the chart; its text stays the same size at any width.
    <div className="relative max-w-[520px]">
      <ChartContainer className="aspect-auto h-[220px] w-full md:h-[260px]">
        <LineChart data={rows} margin={{ top: twoRows ? 40 : 24, right: 28, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} />
          <Bands mistake={mistake} />
          <XAxis
            dataKey="day"
            tickFormatter={(d: Day) => dayLabel(d, day)}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={40}
          />
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
            content={({ active, payload, label }) => {
              const row = active ? payload?.[0]?.payload : undefined;
              const rate = row?.after ?? row?.before;
              if (rate == null || picked) return null;
              const part = row.after != null && mistake.rule ? "after" : row.before != null ? "before" : "earlier";
              return (
                <ChartTip
                  title={dayLabel(String(label), day)}
                  rows={[
                    {
                      name: { after: "Since rule", before: mistake.rule ? "Before rule" : "Share", earlier: "Earlier" }[
                        part
                      ],
                      value: percent(rate),
                      swatch: { after: "bg-with", before: "bg-without", earlier: "bg-muted-foreground" }[part],
                    },
                  ]}
                />
              );
            }}
          />
          {(["earlier", "before", "after"] as const).map((key) => (
            <Line
              key={key}
              dataKey={key}
              {...SERIES_STYLE[key]}
              type="linear"
              connectNulls={false}
              isAnimationActive={false}
              dot={(props) => <PointMark key={props.index} {...props} series={key} />}
              activeDot={{ r: 4 }}
            />
          ))}
          <Markers changes={mistake.changes} day={day} picked={picked?.day ?? null} onPick={setPicked} />
        </LineChart>
      </ChartContainer>
      {picked && <MarkerTip picked={picked} day={day} />}
    </div>
  );
}
