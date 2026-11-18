import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import type { Day, Report } from "@/data/report";
import { isClipped, stripPosition } from "@/lib/change";
import { dayLabel, number, signedPercent } from "@/lib/format";
import { handText } from "@/lib/hand";
import { rowHref } from "@/lib/hash";
import { checkRows } from "@/lib/permanent";
import type { Drawn, Row } from "@/lib/rows";
import { STATUS_WORDS, type Status } from "@/lib/status";
import { lookLabels, trendRows } from "@/lib/trials";
import { ruleTrust, type Trust, trialTrust } from "@/lib/trust";
import { cn } from "@/lib/utils";
import { Band } from "./band";
import { TrendChart } from "./charts/trend-chart";
import { CopyButton } from "./copy-button";
import { STATUS_TONE } from "./status-icon";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section data-section={id} className="grid gap-2.5">
      <h3 className="font-medium text-muted-foreground text-xs">{title}</h3>
      {children}
    </section>
  );
}

/** Labelled values, one a line; a third item is the key when labels repeat. */
function Facts({ facts }: { facts: [string, string, string?][] }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] text-xs">
      {facts.map(([label, value, key]) => (
        <div key={key ?? label} className="col-span-2 grid grid-cols-subgrid border-t py-1.5">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TrustBars({ trust }: { trust: Trust }) {
  const scale = Math.max(trust.needed * 1.25, trust.with, trust.without);
  const line = `${(trust.needed / scale) * 100}%`;
  const bar = (label: string, tasks: number) => (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="relative h-1.5 rounded-full bg-muted">
        <span
          data-bar={tasks}
          className="absolute inset-y-0 left-0 rounded-full bg-foreground"
          style={{ width: `${(tasks / scale) * 100}%` }}
        />
        <span className="absolute -inset-y-1 border-ring border-l border-dashed" style={{ left: line }} />
      </span>
      <span className="text-right font-mono">{number(tasks)}</span>
    </>
  );
  return (
    <>
      <div className="grid grid-cols-[4.25rem_minmax(0,1fr)_2.5rem] items-center gap-x-2.5 gap-y-1.5 text-xs">
        <span />
        <span className="relative h-4 font-mono text-muted-foreground">
          <span data-needed className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: line }}>
            {trust.neededWords}
          </span>
        </span>
        <span />
        {bar("With rule", trust.with)}
        {bar("Without", trust.without)}
      </div>
      <Facts facts={[["Enough tasks", trust.enough]]} />
    </>
  );
}

/** The band again at full width, with its range's own numbers under its ends. */
function Change({ change, status }: { change: Drawn; status: Status }) {
  const low = stripPosition(change.low);
  const high = stripPosition(change.high);
  // Two numbers under a narrow band would overlap, so each then grows away from the other.
  const narrow = high - low < 0.2;
  const end = (at: number, side: "low" | "high", text: string) => (
    <span
      data-end={side}
      className={cn(
        "absolute top-0 whitespace-nowrap",
        (side === "low" ? narrow || at > 0.9 : at > 0.9) && "-translate-x-full",
        !narrow && at >= 0.1 && at <= 0.9 && "-translate-x-1/2",
      )}
      style={{ left: `${at * 100}%` }}
    >
      {text}
    </span>
  );
  return (
    <div className={STATUS_TONE[status]}>
      {/* Beside the table the row already gives the number; alone on a phone the card has to. */}
      <p data-estimate className="mb-1 font-medium font-mono text-base min-[1100px]:hidden">
        {signedPercent(change.value)}
      </p>
      <Band change={change} status={status} large />
      <div className="relative mt-1 h-4 font-mono text-muted-foreground text-xs">
        {end(low, "low", signedPercent(change.low))}
        {end(high, "high", isClipped(change) ? `${signedPercent(change.high)} ›` : signedPercent(change.high))}
      </div>
    </div>
  );
}

/** A trial's rate by day of the trial; an active rule's by date over the days its numbers count. */
function RateOverTime({ row, day }: { row: Row; day: Day }) {
  if (row.kind === "trial") {
    return (
      <TrendChart
        rows={trendRows(row.trial)}
        marks={lookLabels(row.trial)}
        // Seven "Day n" labels do not fit the card, so only the first names the unit.
        tickFormatter={(label, index) => (index === 0 ? label : label.replace("Day ", ""))}
      />
    );
  }
  const { rows, ticks } = checkRows(row.check, day);
  return <TrendChart rows={rows} ticks={ticks} />;
}

function hasRates(row: Row): boolean {
  const trend = row.kind === "trial" ? row.trial.trend : row.check.trend;
  return trend.filter((t) => t.with !== null || t.without !== null).length > 1;
}

/** One rule in full. Every card has the same sections in the same order; a rule with no answer stops after trust. */
export function RuleCard({ row, day }: { row: Row; day: Day }) {
  const trial = row.kind === "trial" ? row.trial : null;
  const trust = row.kind === "trial" ? trialTrust(row.trial) : ruleTrust(row.check, day);
  const misses = row.kind === "trial" ? row.trial.misses : row.check.misses;
  return (
    <div
      data-detail={row.id}
      className="grid gap-5 p-4.5 motion-safe:fade-in motion-safe:animate-in motion-safe:duration-150"
    >
      <a
        href={rowHref(null)}
        className="-my-1 flex min-h-8 items-center gap-1 text-muted-foreground text-xs min-[1100px]:hidden"
      >
        <ChevronLeft aria-hidden className="size-3.5" />
        All rules
      </a>
      <section data-section="verdict">
        <h2 className="text-balance font-semibold text-[0.9375rem]">{row.name}</h2>
        <p data-verdict className={cn("mt-0.5 font-medium", STATUS_TONE[row.status])}>
          {STATUS_WORDS[row.status]}
          {trial?.state === "scheduled" && (
            <span className="font-normal text-muted-foreground"> Starts {dayLabel(trial.started, day)}</span>
          )}
        </p>
      </section>
      <Section id="trust" title="Can it be trusted">
        <TrustBars trust={trust} />
      </Section>
      {row.change && (
        <Section id="change" title="Change in mistakes">
          <Change change={row.change} status={row.status} />
        </Section>
      )}
      {row.change && hasRates(row) && (
        <Section id="rate" title="Mistake rate over time">
          <RateOverTime row={row} day={day} />
        </Section>
      )}
      {row.status !== "not-enough" && (
        <Section id="hand" title="Hand to an agent">
          {misses.length > 0 && (
            <div data-misses>
              <p className="mb-1 text-muted-foreground text-xs">Latest mistakes</p>
              <Facts
                facts={misses.map((miss) => [
                  dayLabel(miss.day, day),
                  miss.side === "with" ? "With rule" : "Without",
                  miss.session,
                ])}
              />
            </div>
          )}
          <CopyButton text={() => handText(row, day)}>Copy for an agent</CopyButton>
        </Section>
      )}
    </div>
  );
}

/** With no rule picked, the card says once how every number on the page is made and what each mark means. */
export function PageFacts({ report }: { report: Report }) {
  return (
    <div
      data-detail="page"
      className="grid gap-4 p-4.5 motion-safe:fade-in motion-safe:animate-in motion-safe:duration-150"
    >
      <div>
        <h2 className="font-semibold text-[0.9375rem]">How these numbers are made</h2>
        <p className="mt-0.5 text-muted-foreground text-xs">Pick a rule to see its evidence.</p>
      </div>
      <Facts
        facts={[
          [`Conversations on ${dayLabel(report.day, report.day)}`, number(report.sessions.total)],
          ["In an experiment", number(report.sessions.in_group)],
          ["How tasks are split", "At random, by task"],
          ["A band", "Where the change lies 9 times in 10"],
          ["−63%", "63% fewer mistakes with the rule"],
          ["Dashed line on a band", "The 30% cut a rule must reach"],
          ["Dashed lines on a chart", "Days it was checked"],
          ["Tasks needed", "To find a halving 4 times in 5"],
          ["A do-nothing rule passes", "Under 7% of the time"],
        ]}
      />
    </div>
  );
}
