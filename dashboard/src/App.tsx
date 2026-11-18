import { Dashboard } from "@/dashboard";
import type { Report } from "@/data/report";
import { dayLabel, timeLabel } from "@/lib/format";

/** As wide as the table and the card need, centred, so a wide screen never stretches the page. */
const FRAME = "mx-auto w-full max-w-[1080px]";

export function App({ report }: { report: Report }) {
  return (
    <main className="px-4 pb-12">
      <div data-frame className={FRAME}>
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-7 pb-4">
          <h1 className="font-semibold text-lg tracking-tight">Rule experiments</h1>
          <p className="font-mono text-muted-foreground text-xs">
            data to {dayLabel(report.day, report.day)}, written {timeLabel(report.written)}
          </p>
        </header>
        <Dashboard report={report} />
      </div>
    </main>
  );
}
