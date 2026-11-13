import { ChevronRight, CircleCheck } from "lucide-react";
import { useRef } from "react";
import { ChangeMarks, StripAxis, StripAxisCell } from "@/components/change-strip";
import { MistakeDetail } from "@/components/mistake-detail";
import { RateBar, RateValue, type Side } from "@/components/rate-pair";
import { CELL, GridHeader, GridRow } from "@/components/rule-grid";
import { Empty, Section } from "@/components/section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { Day, Mistake, Report, Trial } from "@/data/report";
import { useMedia } from "@/hooks/use-media";
import { replaceHash } from "@/hooks/use-route";
import { type AttentionItem, attentionItems, calmLine } from "@/lib/attention";
import { percent, plural } from "@/lib/format";
import { NO_RECENT_TASKS, overviewHint, scoreWords, slug, sortByChange, withoutRule, withRule } from "@/lib/mistakes";
import { permanentSummary, statusCounts } from "@/lib/permanent";
import { sortTrials, trialSummary, verdictWords } from "@/lib/trials";
import { cn } from "@/lib/utils";
import { href, selectHref } from "@/routes";

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
        <p data-block className="flex items-start gap-2 text-muted-foreground">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-good" />
          {calmLine(report.day)}
        </p>
      ) : (
        <ul data-block className="grid gap-3 @3xl:grid-cols-2">
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
      <div data-block className="grid gap-4 @3xl:grid-cols-2">
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

/** How a table's rows take part in the page's one selection. */
interface Picking {
  selected: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, step: 1 | -1) => void;
}

function rowProps(m: Mistake, picking: Picking) {
  const id = slug(m.name);
  return {
    id,
    selected: picking.selected === id,
    onSelect: () => picking.onSelect(id),
    onMove: (step: 1 | -1) => picking.onMove(id, step),
  };
}

/** The overview's scorecard: one row per mistake with a rule, and one chart, the change, in each row. */
function RulesTable({ rows, day, picking }: { rows: Mistake[]; day: Day; picking: Picking }) {
  if (rows.length === 0) return <Empty>No rule has been tried on a mistake yet</Empty>;
  return (
    <div
      data-table="rules"
      data-block
      role="listbox"
      aria-label="Rules and their mistakes"
      className="space-y-3 md:space-y-0"
    >
      <GridHeader>
        <span>Mistake</span>
        <span className="text-right whitespace-nowrap">Before → since</span>
        <StripAxisCell />
        <span>Result</span>
      </GridHeader>
      {rows.map((m) => {
        const words = scoreWords(m);
        return (
          <GridRow key={m.name} {...rowProps(m, picking)}>
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
function NoRuleTable({ rows, picking }: { rows: Mistake[]; picking: Picking }) {
  if (rows.length === 0) return <Empty>Every tracked mistake has a rule</Empty>;
  return (
    <div
      data-table="no-rule"
      data-block
      role="listbox"
      aria-label="Mistakes with no rule yet"
      className="space-y-3 md:space-y-0"
    >
      <GridHeader>
        <span>Mistake</span>
        <span className="text-right">Rate now</span>
        <span />
        <span>Tasks</span>
      </GridHeader>
      {rows.map((m) => (
        <GridRow key={m.name} {...rowProps(m, picking)}>
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

/** The selected mistake in full, with a way to its card among all tracked mistakes. */
function Detail({ mistake, day }: { mistake: Mistake; day: Day }) {
  return (
    <div data-detail={slug(mistake.name)} className="space-y-4">
      <MistakeDetail mistake={mistake} day={day} />
      <a
        href={href("mistakes", slug(mistake.name))}
        className="inline-flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground"
      >
        All tracked mistakes
        <ChevronRight className="size-4" />
      </a>
    </div>
  );
}

/** Wide enough for the tables and the detail panel side by side. */
const WIDE = "(min-width: 1360px)";

/**
 * The overview. On a wide screen the tables sit in a left column and the selected mistake's detail stays in view on the
 * right (the first rule's mistake until one is picked); narrower, nothing is picked until a row is tapped, and the
 * detail opens in a sheet from the right. The pick lives in the hash, so it survives a reload and can be linked.
 */
export function OverviewPage({ report, selected }: { report: Report; selected: string | null }) {
  const wide = useMedia(WIDE);
  const rules = sortByChange(withRule(report.mistakes));
  const noRule = withoutRule(report.mistakes);
  const order = [...rules, ...noRule];
  const picked = order.find((m) => slug(m.name) === selected) ?? (wide ? order[0] : undefined);
  const pickedId = picked ? slug(picked.name) : null;
  const lastPicked = useRef<string | null>(null);
  if (pickedId) lastPicked.current = pickedId;
  // While the sheet slides shut the pick is already cleared; keep showing the last one until it has gone.
  const shown = picked ?? order.find((m) => slug(m.name) === lastPicked.current);
  const row = (id: string | null) => document.querySelector<HTMLElement>(`[data-row="${id}"]`);
  const picking: Picking = {
    selected: pickedId,
    onSelect: (id) => replaceHash(selectHref(id)),
    onMove: (id, step) => {
      const at = order.findIndex((m) => slug(m.name) === id);
      const next = order[at + step];
      if (!next) return;
      replaceHash(selectHref(slug(next.name)));
      row(slug(next.name))?.focus();
    },
  };
  const tables = (
    <div className="@container min-w-0 space-y-10">
      <NeedsAttention report={report} />
      <RunningNow report={report} />
      <Section title="Rules and their mistakes">
        <RulesTable rows={rules} day={report.day} picking={picking} />
      </Section>
      <Section title="Mistakes with no rule yet">
        <NoRuleTable rows={noRule} picking={picking} />
      </Section>
    </div>
  );
  if (order.length === 0) return <div className="max-w-3xl">{tables}</div>;
  if (wide) {
    return (
      <div className="grid grid-cols-[minmax(620px,3fr)_minmax(380px,2fr)] gap-8">
        {tables}
        {picked && (
          <aside
            aria-label="Selected mistake"
            className="sticky top-4 max-h-[calc(100svh-2rem)] self-start overflow-y-auto border-l pl-8"
          >
            <Detail mistake={picked} day={report.day} />
          </aside>
        )}
      </div>
    );
  }
  return (
    <>
      {tables}
      <Sheet open={picked !== undefined} onOpenChange={(open) => !open && replaceHash(selectHref(null))}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-4 pt-12 data-[side=right]:w-full sm:max-w-lg data-[side=right]:sm:max-w-lg"
          finalFocus={() => row(lastPicked.current)}
        >
          <SheetTitle className="sr-only">{shown?.name ?? "Mistake"}</SheetTitle>
          {shown && <Detail mistake={shown} day={report.day} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
