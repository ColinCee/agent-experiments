import { ChangeStrip } from "@/components/change-strip";
import { TrendChart } from "@/components/charts/trend-chart";
import { PairLegend, RatePair, type Side, Swatch } from "@/components/rate-pair";
import { StatusBadge } from "@/components/status-badge";
import type { Day, Trial } from "@/data/report";
import { fewTasks, number } from "@/lib/format";
import { hasResult, missingTrialChange, neededWords, taskScale, tasksNote, trialBadge, trialWhen } from "@/lib/trials";
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
        <div className="absolute inset-0 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3" aria-hidden>
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

function Result({ trial }: { trial: Trial }) {
  const few = fewTasks([
    { tasks: trial.tasks_without, label: "without the rule" },
    { tasks: trial.tasks_with, label: "with it" },
  ]);
  return (
    <div className="space-y-3">
      <PairLegend from="without the rule" to="with the rule" />
      {few && <p className="text-sm text-muted-foreground">{few}</p>}
      <RatePair without={trial.rate_without} withRule={trial.rate_with} labelled />
      <ChangeStrip change={trial.change} same="same as without" missing={missingTrialChange(trial)} />
    </div>
  );
}

/** A trial in full: where it is, its tasks against those needed, its result so far and its rates day by day. */
export function TrialDetail({ trial, day }: { trial: Trial; day: Day }) {
  const badge = trialBadge(trial);
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg leading-snug font-medium">{trial.name}</h3>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <StatusBadge tone={badge.tone}>{badge.text}</StatusBadge>
          {trialWhen(trial, day, true)}
        </div>
      </div>
      <Tasks trial={trial} />
      {hasResult(trial) && <Result trial={trial} />}
      {trial.state !== "scheduled" && trial.trend.length > 0 && <TrendChart trial={trial} />}
    </div>
  );
}
