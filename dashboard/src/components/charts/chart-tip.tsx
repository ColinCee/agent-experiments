import { cn } from "@/lib/utils";

export interface TipRow {
  name: string;
  value: string;
  /** A swatch class such as bg-with; none for a neutral line. */
  swatch?: string;
}

/** The hover box of every chart: what the point is (a date, a day of the trial) and its values. */
export function ChartTip({ title, rows }: { title: string; rows: TipRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="grid min-w-32 gap-1 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground">
      <div className="font-medium">{title}</div>
      {rows.map((row) => (
        <div key={row.name} className="flex items-center gap-2">
          {row.swatch && <span className={cn("size-2 rounded-full", row.swatch)} />}
          <span className="text-muted-foreground">{row.name}</span>
          <span className="ml-auto font-medium">{row.value}</span>
        </div>
      ))}
    </div>
  );
}
