import { ChangeMarks, StripAxis } from "@/components/change-strip";
import { HistoryChart } from "@/components/charts/history-chart";
import { RateValue, Swatch } from "@/components/rate-pair";
import { Empty } from "@/components/section";
import type { Day, Mistake } from "@/data/report";
import { percent } from "@/lib/format";
import {
  currentWords,
  detailChange,
  fewTasksNote,
  NO_RECENT_TASKS,
  ruleSince,
  ruleTasks,
  todayChip,
} from "@/lib/mistakes";
import { cn } from "@/lib/utils";

const LEAD = { good: "text-good", bad: "text-bad", unclear: "text-foreground" } as const;

/** The change against before the rule with its range, read without hovering, and the strip that draws it. */
function ChangeLine({ mistake }: { mistake: Mistake }) {
  const change = detailChange(mistake);
  return (
    <div className="space-y-1.5">
      <p data-change-line className="leading-snug">
        <span className={cn("font-semibold", LEAD[change.tone])}>{change.lead}</span>
        {change.rest && <span className="text-sm text-muted-foreground"> · {change.rest}</span>}
      </p>
      {mistake.change?.low != null && (
        <div className="max-w-sm space-y-1 pr-2.5">
          <StripAxis same="same as before" />
          <ChangeMarks change={mistake.change} tone={change.tone} />
        </div>
      )}
    </div>
  );
}

function RuleNumbers({ mistake, day }: { mistake: Mistake; day: Day }) {
  const few = fewTasksNote(mistake);
  const rate = (r: number | undefined) => (r === undefined ? "–" : percent(r));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <Swatch side="without">
          Before rule <RateValue rate={rate(mistake.before?.rate)} side="without" className="text-lg" />
        </Swatch>
        <Swatch side="with">
          Since rule <RateValue rate={rate(mistake.after?.rate)} side="with" className="text-lg" />
        </Swatch>
      </div>
      <ChangeLine mistake={mistake} />
      <p className="text-sm text-muted-foreground">
        {ruleTasks(mistake, day)}
        {few && <span className="block">{few}</span>}
      </p>
    </div>
  );
}

function CurrentNumbers({ mistake, day }: { mistake: Mistake; day: Day }) {
  const words = currentWords(mistake, day);
  if (words === null) return <Empty>{NO_RECENT_TASKS}</Empty>;
  return (
    <div className="space-y-1">
      <RateValue rate={words.rate} side="without" className="text-lg" />
      <p className="text-sm text-muted-foreground">{words.tasks}</p>
    </div>
  );
}

/** The day's rate against its usual range, only when outside it: plain words with a dot, never a status badge. */
function TodayNote({ mistake }: { mistake: Mistake }) {
  const chip = todayChip(mistake);
  if (!chip) return null;
  return (
    <span data-today className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <span className={cn("size-2 shrink-0 rounded-full", chip.tone === "bad" ? "bg-bad" : "bg-good")} />
      {chip.text}
    </span>
  );
}

/**
 * Everything about one mistake: its name and today's note, its rates (with the change and its range), its history
 * chart and its rule. The Tracked mistakes cards and the overview's detail panel both show it.
 */
export function MistakeDetail({ mistake, day }: { mistake: Mistake; day: Day }) {
  const since = ruleSince(mistake, day);
  const hasData = mistake.series.some((p) => p.rate !== null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-lg leading-snug font-medium">{mistake.name}</h3>
        <TodayNote mistake={mistake} />
      </div>
      {mistake.rule ? <RuleNumbers mistake={mistake} day={day} /> : <CurrentNumbers mistake={mistake} day={day} />}
      {hasData ? (
        <HistoryChart mistake={mistake} day={day} />
      ) : (
        <Empty className="text-sm">No chances for this mistake in the last 6 weeks</Empty>
      )}
      {since && (
        <p data-rule-line className="text-sm">
          {since}
        </p>
      )}
    </div>
  );
}
