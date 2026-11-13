import { ChangeText } from "@/components/change-strip";
import { HistoryChart } from "@/components/charts/history-chart";
import { RateValue, Swatch } from "@/components/rate-pair";
import { Empty, PageIntro, Section } from "@/components/section";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Day, Mistake, Report } from "@/data/report";
import { percent } from "@/lib/format";
import {
  currentWords,
  NO_RECENT_TASKS,
  ruleSince,
  ruleTasks,
  slug,
  todayChip,
  withoutRule,
  withRule,
} from "@/lib/mistakes";
import { cn } from "@/lib/utils";

function RuleNumbers({ mistake }: { mistake: Mistake }) {
  const rate = (r: number | undefined) => (r === undefined ? "–" : percent(r));
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <Swatch side="without">
          Before rule <RateValue rate={rate(mistake.before?.rate)} side="without" className="text-lg" />
        </Swatch>
        <Swatch side="with">
          Since rule <RateValue rate={rate(mistake.after?.rate)} side="with" className="text-lg" />
        </Swatch>
        <ChangeText change={mistake.change} />
      </div>
      <p className="text-sm text-muted-foreground">{ruleTasks(mistake)}</p>
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

function MistakeCard({ mistake, day, target }: { mistake: Mistake; day: Day; target: boolean }) {
  const chip = todayChip(mistake);
  const since = ruleSince(mistake, day);
  const hasData = mistake.series.some((p) => p.rate !== null);
  return (
    <Card id={slug(mistake.name)} className={cn("scroll-mt-4", target && "ring-2 ring-foreground/40")}>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <CardTitle className="text-lg">{mistake.name}</CardTitle>
        {chip && <StatusBadge tone={chip.tone}>{chip.text}</StatusBadge>}
      </CardHeader>
      <CardContent className="space-y-4">
        {mistake.rule ? <RuleNumbers mistake={mistake} /> : <CurrentNumbers mistake={mistake} day={day} />}
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
      </CardContent>
    </Card>
  );
}

function Group({
  title,
  mistakes,
  day,
  target,
}: {
  title: string;
  mistakes: Mistake[];
  day: Day;
  target: string | null;
}) {
  if (mistakes.length === 0) return null;
  return (
    <Section title={title}>
      <div className="grid gap-4 xl:grid-cols-2">
        {mistakes.map((m) => (
          <MistakeCard key={m.name} mistake={m} day={day} target={slug(m.name) === target} />
        ))}
      </div>
    </Section>
  );
}

export function MistakesPage({ report, target }: { report: Report; target: string | null }) {
  return (
    <>
      <PageIntro>Share of chances where the mistake happened, 3-day average.</PageIntro>
      {report.mistakes.length === 0 ? (
        <Empty>No mistakes are tracked yet</Empty>
      ) : (
        <div className="space-y-10">
          <Group title="With a rule" mistakes={withRule(report.mistakes)} day={report.day} target={target} />
          <Group title="No rule yet" mistakes={withoutRule(report.mistakes)} day={report.day} target={target} />
        </div>
      )}
    </>
  );
}
