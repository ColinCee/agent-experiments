import { AlignWithStrip, ChangeStrip } from "@/components/change-strip";
import { TrendChart } from "@/components/charts/trend-chart";
import { RatePair, RateValue, type Side, Swatch } from "@/components/rate-pair";
import { Empty } from "@/components/section";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Day, Report, Trial } from "@/data/report";
import { number, percent } from "@/lib/format";
import { hasResult, neededWords, sortTrials, taskScale, tasksNote, trialBadge, trialWhen } from "@/lib/trials";
import { cn } from "@/lib/utils";

function TaskBar({ side, label, tasks, scale }: { side: Side; label: string; tasks: number; scale: number }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3">
      <span className="text-sm">
        <Swatch side={side}>
          {label} <span className="font-semibold">{number(tasks)}</span>
        </Swatch>
      </span>
      <div className="relative h-3 rounded-sm bg-muted">
        <div
          data-tasks={tasks}
          className={cn("absolute inset-y-0 left-0 rounded-sm", side === "with" ? "bg-with" : "bg-without")}
          style={{ width: `${(tasks / scale) * 100}%` }}
        />
      </div>
    </div>
  );
}

/** Tasks in each half on one scale whose full width is the tasks needed, with a tick there. */
function Tasks({ trial }: { trial: Trial }) {
  const scale = taskScale(trial);
  const needed = trial.needed === null ? 1 : trial.needed / scale;
  const note = tasksNote(trial);
  return (
    <div className="space-y-2">
      <div className="relative space-y-2 pt-5">
        <div
          className="absolute top-0 bottom-0 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3"
          style={{ left: 0, right: 0 }}
          aria-hidden
        >
          <span />
          <div className="relative">
            <div className="absolute top-5 bottom-0 w-px bg-foreground/60" style={{ left: `${needed * 100}%` }} />
            <span
              className="absolute top-0 -translate-x-full text-xs whitespace-nowrap text-muted-foreground"
              style={{ left: `${needed * 100}%` }}
            >
              {neededWords(trial)}
            </span>
          </div>
        </div>
        <TaskBar side="with" label="With the rule" tasks={trial.tasks_with} scale={scale} />
        <TaskBar side="without" label="Without" tasks={trial.tasks_without} scale={scale} />
      </div>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}

function Result({ trial, axis }: { trial: Trial; axis: boolean }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Result so far</h3>
      <div className="flex flex-wrap gap-x-6 text-sm">
        <Swatch side="without">
          Without <RateValue rate={trial.rate_without === null ? "–" : percent(trial.rate_without)} side="without" />
        </Swatch>
        <Swatch side="with">
          With the rule <RateValue rate={trial.rate_with === null ? "–" : percent(trial.rate_with)} side="with" />
        </Swatch>
      </div>
      <AlignWithStrip>
        <RatePair without={trial.rate_without} withRule={trial.rate_with} />
      </AlignWithStrip>
      <ChangeStrip change={trial.change} axis={axis} />
    </div>
  );
}

function TrialCard({ trial, day, first }: { trial: Trial; day: Day; first: boolean }) {
  const badge = trialBadge(trial);
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <CardTitle className="text-lg">{trial.name}</CardTitle>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <StatusBadge tone={badge.tone}>{badge.text}</StatusBadge>
          {trialWhen(trial, day, true)}
        </div>
      </CardHeader>
      <CardContent className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <Tasks trial={trial} />
          {hasResult(trial) && <Result trial={trial} axis={first} />}
        </div>
        {trial.state !== "scheduled" && trial.trend.length > 0 && (
          <div className="min-w-0">
            <TrendChart trial={trial} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TrialsPage({ report }: { report: Report }) {
  const trials = sortTrials(report.trials);
  if (trials.length === 0) return <Empty>No trials yet. A trial starts when a rule is tried on a mistake.</Empty>;
  const firstWithResult = trials.find(hasResult);
  return (
    <div className="space-y-6">
      {trials.map((t) => (
        <TrialCard key={`${t.name} ${t.started}`} trial={t} day={report.day} first={t === firstWithResult} />
      ))}
    </div>
  );
}
