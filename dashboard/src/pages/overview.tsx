import { ChevronRight, CircleCheck } from "lucide-react";
import { ChangeMarks, StripAxis, StripAxisCell } from "@/components/change-strip";
import { RateBar, RateValue, type Side } from "@/components/rate-pair";
import { CELL, GridHeader, GridRow } from "@/components/rule-grid";
import { Empty, Section } from "@/components/section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Day, Mistake, Report, Trial } from "@/data/report";
import { type AttentionItem, attentionItems, calmLine } from "@/lib/attention";
import { percent, plural } from "@/lib/format";
import { NO_RECENT_TASKS, overviewHint, scoreWords, slug, sortByChange, withoutRule, withRule } from "@/lib/mistakes";
import { permanentSummary, statusCounts } from "@/lib/permanent";
import { sortTrials, trialSummary, verdictWords } from "@/lib/trials";
import { cn } from "@/lib/utils";
import { href } from "@/routes";

const TINT: Record<AttentionItem["tone"], string> = {
  bad: "border-bad/30 bg-bad/8",
  good: "border-good/30 bg-good/8",
  neutral: "border-border",
};

function NeedsAttention({ report }: { report: Report }) {
  const items = attentionItems(report);
  return (
    <Section title="Needs attention">
      {items.length === 0 ? (
        <p className="flex items-start gap-2 text-muted-foreground">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-good" />
          {calmLine(report.day)}
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <li key={`${item.title} ${item.detail}`} className={cn("rounded-lg border px-4 py-3", TINT[item.tone])}>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function CardLink({ to, children }: { to: string; children: string }) {
  return (
    <a href={to} className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground">
      {children}
      <ChevronRight className="size-4" />
    </a>
  );
}

function TrialLine({ trial, day }: { trial: Trial; day: string }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
      <span className="font-medium">{trial.name}</span>
      <span className="text-sm text-muted-foreground">
        {trialSummary(trial, day)}
        {trial.state !== "scheduled" && (
          <>
            {" · "}
            <span className="text-foreground">{verdictWords(trial.verdict)}</span>
          </>
        )}
      </span>
    </li>
  );
}

function RunningNow({ report }: { report: Report }) {
  const trials = sortTrials(report.trials);
  return (
    <Section title="Running now">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="grid-cols-[1fr_auto]">
            <CardTitle>Trials</CardTitle>
            <CardLink to={href("trials")}>All trials</CardLink>
          </CardHeader>
          <CardContent>
            {trials.length === 0 ? (
              <Empty>No trials yet</Empty>
            ) : (
              <ul className="-my-2.5 divide-y">
                {trials.map((t) => (
                  <TrialLine key={`${t.name} ${t.started}`} trial={t} day={report.day} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="grid-cols-[1fr_auto]">
            <CardTitle>Permanent check</CardTitle>
            <CardLink to={href("permanent")}>All rules</CardLink>
          </CardHeader>
          <CardContent className="space-y-1">
            <p>{permanentSummary(report.permanent, report.day)}</p>
            {report.permanent.length > 0 && (
              <p className="text-sm text-muted-foreground">{statusCounts(report.permanent)}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </Section>
  );
}

/** A rate as text in its side's colour, or a dash when that side had no tasks. */
function Rate({ rate, side }: { rate: number | null | undefined; side: Side }) {
  return rate == null ? (
    <span className="text-muted-foreground">–</span>
  ) : (
    <RateValue rate={percent(rate)} side={side} className="font-medium" />
  );
}

/** "31% → 6%", in fixed-width parts so the arrows of every row line up. */
function BeforeSince({ mistake }: { mistake: Mistake }) {
  return (
    <span className="inline-grid grid-cols-[3rem_1.5rem_3rem] items-baseline">
      <span className="text-right">
        <Rate rate={mistake.before?.rate} side="without" />
      </span>
      <span className="text-center text-muted-foreground">→</span>
      <Rate rate={mistake.after?.rate} side="with" />
    </span>
  );
}

function HintLine({ mistake, day }: { mistake: Mistake; day: Day }) {
  const hint = overviewHint(mistake, day);
  return hint && <span className="block text-sm text-muted-foreground">{hint}</span>;
}

const LEAD = { good: "text-good", bad: "text-bad", unclear: "text-foreground" } as const;

/** The overview's scorecard: one row per mistake with a rule, and one chart, the change, in each row. */
function RulesTable({ mistakes, day }: { mistakes: Mistake[]; day: Day }) {
  const rows = sortByChange(withRule(mistakes));
  if (rows.length === 0) return <Empty>No rule has been tried on a mistake yet</Empty>;
  return (
    <div data-table="rules" className="space-y-3 md:max-w-[880px] md:space-y-0">
      <GridHeader>
        <span>Mistake</span>
        <span className="text-right whitespace-nowrap">Before → since rule</span>
        <StripAxisCell />
        <span>Result</span>
      </GridHeader>
      {rows.map((m) => {
        const words = scoreWords(m);
        return (
          <GridRow key={m.name} href={href("mistakes", slug(m.name))}>
            <div className={CELL.name}>
              <span className="block font-medium">{m.name}</span>
              <HintLine mistake={m} day={day} />
            </div>
            <div className={CELL.rates}>
              <BeforeSince mistake={m} />
            </div>
            <div className={cn(CELL.chart, "space-y-1 pr-2.5")}>
              <div className="md:hidden">
                <StripAxis />
              </div>
              <ChangeMarks change={m.change} tone={words.tone} tip={words.tip} />
            </div>
            <span className={cn(CELL.result, "font-semibold", LEAD[words.tone])}>{words.lead}</span>
          </GridRow>
        );
      })}
    </div>
  );
}

/** Mistakes with no rule, on the scorecard's columns so their bars line up with the strips above. */
function NoRuleTable({ mistakes }: { mistakes: Mistake[] }) {
  const rows = withoutRule(mistakes);
  if (rows.length === 0) return <Empty>Every tracked mistake has a rule</Empty>;
  return (
    <div data-table="no-rule" className="space-y-3 md:max-w-[880px] md:space-y-0">
      <GridHeader>
        <span>Mistake</span>
        <span className="text-right">Rate now</span>
        <span />
        <span>Tasks</span>
      </GridHeader>
      {rows.map((m) => (
        <GridRow key={m.name} href={href("mistakes", slug(m.name))}>
          <span className={cn(CELL.name, "font-medium")}>{m.name}</span>
          {m.current ? (
            <>
              <span className={CELL.rates}>
                <Rate rate={m.current.rate} side="without" />
              </span>
              <div className={cn(CELL.chart, "pr-2.5")}>
                <RateBar rate={m.current.rate} />
              </div>
              <span className={cn(CELL.result, "text-sm text-muted-foreground")}>
                {plural(m.current.tasks, "task")}
              </span>
            </>
          ) : (
            <span className={cn(CELL.rates, "text-sm text-muted-foreground md:col-span-3 md:justify-self-start")}>
              {NO_RECENT_TASKS}
            </span>
          )}
        </GridRow>
      ))}
    </div>
  );
}

export function OverviewPage({ report }: { report: Report }) {
  return (
    <div className="space-y-10">
      <NeedsAttention report={report} />
      <RunningNow report={report} />
      <Section title="Rules and their mistakes">
        <RulesTable mistakes={report.mistakes} day={report.day} />
      </Section>
      <Section title="Mistakes with no rule yet">
        <NoRuleTable mistakes={report.mistakes} />
      </Section>
    </div>
  );
}
