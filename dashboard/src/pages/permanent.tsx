import { ChangeStrip, StripAxisCell } from "@/components/change-strip";
import { Empty, PageIntro } from "@/components/section";
import { StatusBadge } from "@/components/status-badge";
import type { PermanentCheck, Report } from "@/data/report";
import { dayLabel, number } from "@/lib/format";
import { permanentNote, permanentStatus, STATUS_TONE, STATUS_WORDS, sharedModel } from "@/lib/permanent";
import { cn } from "@/lib/utils";

const COLUMNS =
  "md:grid md:grid-cols-[minmax(0,1fr)_4.5rem_8rem_minmax(0,1fr)_9.5rem_9.5rem] md:items-center md:gap-x-5";

function Row({ check, day, axis }: { check: PermanentCheck; day: string; axis: boolean }) {
  const note = permanentNote(check);
  const status = permanentStatus(check);
  return (
    <div
      className={cn(
        COLUMNS,
        "space-y-2 rounded-lg border p-4 md:space-y-0 md:rounded-none md:border-0 md:border-b md:px-0 md:py-3",
      )}
    >
      <div className="flex items-start justify-between gap-3 md:block">
        <span className="font-medium">{check.name}</span>
        <span className="md:hidden">
          <StatusBadge tone={STATUS_TONE[status]}>{STATUS_WORDS[status]}</StatusBadge>
        </span>
      </div>
      <span className="text-sm text-muted-foreground md:text-base md:text-foreground">
        <span className="md:hidden">Since </span>
        {dayLabel(check.since, day)}
      </span>
      <span className="block text-sm text-muted-foreground md:text-base md:text-foreground">
        {number(check.tasks_without)} / {number(check.tasks_with)}
        <span className="md:hidden"> tasks without / with the rule</span>
      </span>
      {note === null ? (
        <ChangeStrip change={check.change} axis={axis} mode={check.slipping ? "slipping" : "plain"} cells />
      ) : (
        <span className="block text-muted-foreground md:col-span-2">{note}</span>
      )}
      <span className="hidden md:block">
        <StatusBadge tone={STATUS_TONE[status]}>{STATUS_WORDS[status]}</StatusBadge>
      </span>
    </div>
  );
}

export function PermanentPage({ report }: { report: Report }) {
  const checks = report.permanent;
  const model = sharedModel(checks);
  const firstStrip = checks.find((c) => permanentNote(c) === null);
  return (
    <>
      <PageIntro>
        Each proven rule is left off for 1 task in 10, so a model change shows whether the rule still earns its place.
        {model && <span className="mt-1 block text-sm">Checked on {model}</span>}
      </PageIntro>
      {checks.length === 0 ? (
        <Empty>No proven rules yet. A rule joins the check once its trial finds that it works.</Empty>
      ) : (
        <div data-table="permanent" className="space-y-3 md:space-y-0">
          <div className={cn(COLUMNS, "hidden items-end border-b pb-2 text-sm text-muted-foreground md:grid")}>
            <span>Rule</span>
            <span>Since</span>
            <span>Tasks without / with</span>
            <StripAxisCell />
            <span>Result</span>
            <span>Status</span>
          </div>
          {checks.map((c) => (
            <Row key={`${c.name} ${c.since}`} check={c} day={report.day} axis={c === firstStrip} />
          ))}
        </div>
      )}
    </>
  );
}
