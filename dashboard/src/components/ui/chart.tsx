import { cn } from "cn";
import type * as React from "react";
import { ResponsiveContainer, Tooltip } from "recharts";

// Trimmed from shadcn's chart: series take their colour straight from the page's tokens (var(--with) and so on),
// so the config, its per-theme style tag and the legend are gone.

const INITIAL_DIMENSION = { width: 320, height: 200 } as const;

function ChartContainer({
  className,
  children,
  initialDimension = INITIAL_DIMENSION,
  ...props
}: React.ComponentProps<"div"> & {
  children: React.ComponentProps<typeof ResponsiveContainer>["children"];
  initialDimension?: {
    width: number;
    height: number;
  };
}) {
  return (
    <div
      data-slot="chart"
      className={cn(
        "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-surface]:outline-hidden",
        className,
      )}
      {...props}
    >
      <ResponsiveContainer initialDimension={initialDimension}>{children}</ResponsiveContainer>
    </div>
  );
}

const ChartTooltip = Tooltip;

export { ChartContainer, ChartTooltip };
