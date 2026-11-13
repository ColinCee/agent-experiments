import { RangeStrip } from "@/components/change-strip";
import { TrendChart } from "@/components/charts/trend-chart";
import { PairLegend, RatePair, type Side, Swatch } from "@/components/rate-pair";
import type { Day, Trial } from "@/data/report";
import { changeWords } from "@/lib/change";
import { neededEachWay, trialFacts, trialHeadline, trialLine } from "@/lib/details";
import { number } from "@/lib/format";
import { hasResult, missingTrialChange, taskScale } from "@/lib/trials";
import { cn } from "@/lib/utils";
import { type Block, DetailLayout } from "./detail-layout";

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

/** Tasks in each half on one scale whose full width is the tasks needed, its tick labelled with that number once. */
function Progress({ trial }: { trial: Trial }) {
  const scale = taskScale(trial);
  const needed = trial.needed === null ? 1 : trial.needed / scale;
  return (
    <div className="relative space-y-2 pt-5">
      <div className="absolute inset-0 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3" aria-hidden>
        <span />
        <div className="relative">
          <div className="absolute top-5 bottom-0 w-px bg-foreground/60" style={{ left: `${needed * 100}%` }} />
          <span
            className="absolute top-0 -translate-x-full text-xs whitespace-nowrap text-muted-foreground"
            style={{ left: `${needed * 100}%` }}
          >
            {trial.needed === null ? "320+" : number(trial.needed)}
          </span>
        </div>
      </div>
      <TaskBar side="with" label="With the rule" tasks={trial.tasks_with} scale={scale} />
      <TaskBar side="without" label="Without" tasks={trial.tasks_without} scale={scale} />
    </div>
  );
}

/** A trial in full: where it is, its tasks against those needed, its result so far and its rates day by day. */
export function TrialDetail({ trial, day }: { trial: Trial; day: Day }) {
  const words = changeWords(trial.change, "plain", missingTrialChange(trial));
  const blocks: Block[] = [
    { caption: `Tasks so far, out of ${neededEachWay(trial)}`, node: <Progress trial={trial} /> },
  ];
  if (hasResult(trial)) {
    blocks.push({
      caption: "Share of tasks with the mistake so far",
      node: (
        <div className="space-y-3">
          <PairLegend from="without the rule" to="with the rule" />
          <RatePair without={trial.rate_without} withRule={trial.rate_with} labelled />
          <RangeStrip
            change={trial.change}
            tone={words.tone}
            same="same as without"
            words={words.hint ? `${words.lead} · ${words.hint}` : words.lead}
          />
        </div>
      ),
    });
  }
  if (trial.state !== "scheduled" && trial.trend.length > 0) {
    blocks.push({
      caption: "Share of tasks with the mistake, by day of the trial",
      node: <TrendChart trial={trial} />,
    });
  }
  return (
    <DetailLayout
      kind="Trial"
      title={trial.name}
      headline={trialHeadline(trial, day)}
      line={trialLine(trial)}
      blocks={blocks}
      facts={trialFacts(trial, day)}
    />
  );
}
