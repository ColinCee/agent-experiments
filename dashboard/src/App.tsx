import { Dashboard } from "@/dashboard";
import type { Report } from "@/data/report";
import { dayLabel, timeLabel } from "@/lib/format";

/** The page's frame: as wide as the sections and the panel need, centred, so a wide screen never stretches it. */
const FRAME = "mx-auto w-full max-w-[1320px]";

/** A slim bar with the page's title and, once on the screen, how fresh its data is. */
function TopBar({ report }: { report: Report }) {
  return (
    <header className="border-b px-4 md:px-6">
      <div className={`${FRAME} flex h-14 items-center justify-between gap-4`}>
        <h1 className="text-lg font-semibold">Rule experiments</h1>
        <div className="text-right leading-tight">
          <p className="text-sm">Data up to {dayLabel(report.day, report.day)}</p>
          <p className="text-xs text-muted-foreground">Updated {timeLabel(report.written)}</p>
        </div>
      </div>
    </header>
  );
}

export function App({ report }: { report: Report }) {
  return (
    <>
      <TopBar report={report} />
      <main className="px-4 py-6 md:px-6 md:py-8">
        <div data-frame className={FRAME}>
          <Dashboard report={report} />
        </div>
      </main>
    </>
  );
}
