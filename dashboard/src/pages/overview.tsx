import { ChevronRight, CircleCheck } from "lucide-react";
import { ChangeStrip, StripAxisCell } from "@/components/change-strip";
import { RateBar, RatePair, RateValue, type Side, Swatch } from "@/components/rate-pair";
import { GridHeader, GridRow } from "@/components/rule-grid";
import { Empty, Section } from "@/components/section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Mistake, Report, Trial } from "@/data/report";
import { type AttentionItem, attentionItems, calmLine } from "@/lib/attention";
import { fewTasks, percent, plural } from "@/lib/format";
import { missingMistakeChange, NO_RECENT_TASKS, slug, sortByChange, withoutRule, withRule } from "@/lib/mistakes";
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

/** A rate in its column, labelled on phones where there is no header. */
function RateCell({ rate, side, label }: { rate: number | null | undefined; side: Side; label: string }) {
  return (
    <span className="mr-4 inline-block md:mr-0 md:text-right">
      <span className="mr-1.5 text-sm text-muted-foreground md:hidden">
        <Swatch side={side}>{label}</Swatch>
      </span>
      {rate == null ? (
        <span className="text-sm text-muted-foreground">no tasks</span>
      ) : (
        <RateValue rate={percent(rate)} side={side} />
      )}
    </span>
  );
}

function FewTasksLine({ mistake }: { mistake: Mistake }) {
  const few = fewTasks([
    { tasks: mistake.before?.tasks, label: "before" },
    { tasks: mistake.after?.tasks, label: "since the rule" },
  ]);
  return few && <span className="block text-sm text-muted-foreground">{few}</span>;
}

function RulesTable({ mistakes }: { mistakes: Mistake[] }) {
  const rows = sortByChange(withRule(mistakes));
  if (rows.length === 0) return <Empty>No rule has been tried on a mistake yet</Empty>;
  return (
    <div data-table="rules" className="space-y-3 md:space-y-0">
      <GridHeader>
        <span>Mistake</span>
        {/* Wider than their number columns; aligned to the end, they overflow leftwards into the gap. */}
        <span className="flex justify-end whitespace-nowrap">
          <Swatch side="without">Before rule</Swatch>
        </span>
        <span className="flex justify-end whitespace-nowrap">
          <Swatch side="with">Since rule</Swatch>
        </span>
        <span />
        <StripAxisCell />
        <span>Change</span>
      </GridHeader>
      {rows.map((m, i) => (
        <GridRow key={m.name} href={href("mistakes", slug(m.name))}>
          <div>
            <span className="block font-medium">{m.name}</span>
            <FewTasksLine mistake={m} />
          </div>
          <div className="md:contents">
            <RateCell rate={m.before?.rate} side="without" label="Before rule" />
            <RateCell rate={m.after?.rate} side="with" label="Since rule" />
          </div>
          <div className="pr-2.5">
            <RatePair without={m.before?.rate ?? null} withRule={m.after?.rate ?? null} />
          </div>
          <ChangeStrip change={m.change} axis={i === 0} cells missing={missingMistakeChange(m)} />
        </GridRow>
      ))}
    </div>
  );
}

function NoRuleTable({ mistakes }: { mistakes: Mistake[] }) {
  const rows = withoutRule(mistakes);
  if (rows.length === 0) return <Empty>Every tracked mistake has a rule</Empty>;
  return (
    <div data-table="no-rule" className="space-y-3 md:space-y-0">
      <GridHeader>
        <span>Mistake</span>
        <span className="text-right">Rate now</span>
        <span />
        <span />
        <span className="col-span-2">Tasks</span>
      </GridHeader>
      {rows.map((m) => (
        <GridRow key={m.name} href={href("mistakes", slug(m.name))}>
          <span className="block font-medium">{m.name}</span>
          {m.current ? (
            <>
              <RateCell rate={m.current.rate} side="without" label="Rate now" />
              <span className="hidden md:block" />
              <div className="pr-2.5">
                <RateBar rate={m.current.rate} />
              </div>
              <span className="block text-sm text-muted-foreground md:col-span-2">
                {plural(m.current.tasks, "task")}
              </span>
            </>
          ) : (
            <span className="block text-sm text-muted-foreground md:col-span-5">{NO_RECENT_TASKS}</span>
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
        <RulesTable mistakes={report.mistakes} />
      </Section>
      <Section title="Mistakes with no rule yet">
        <NoRuleTable mistakes={report.mistakes} />
      </Section>
    </div>
  );
}
