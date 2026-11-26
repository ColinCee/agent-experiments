import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import type { Day, Report, Side, Trial } from "@/data/report";
import { isClipped, stripPosition } from "@/lib/change";
import { rateCeiling, rateTicks } from "@/lib/charts";
import { dayLabel, number, percent, signedPercent } from "@/lib/format";
import { handText } from "@/lib/hand";
import { rowHref } from "@/lib/hash";
import type { Drawn, Row } from "@/lib/rows";
import { REAL_DAYS, STATUS_WORDS, type Status } from "@/lib/status";
import { cn } from "@/lib/utils";
import { Band } from "./band";
import { CopyButton } from "./copy-button";
import { STATUS_TONE } from "./status-icon";

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section data-section={id} className="grid gap-2.5">
      <h3 className="font-medium text-muted-foreground text-xs">{title}</h3>
      {children}
    </section>
  );
}

/** Labelled values, one a line; a third item is the key when labels repeat. */
export function Facts({ facts }: { facts: [string, string, string?][] }) {
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

/** Each side's mistake rate as a dot on one axis, with its 90% range as a band behind it. */
function BeforeAfter({ trial, day }: { trial: Trial; day: Day }) {
  const sides = [
    ["before", "Before", trial.before],
    ["after", "Since", trial.after],
  ] as const;
  const top = rateCeiling(sides.flatMap(([, , s]) => (s ? [s.rate, s.high] : [])));
  const at = (rate: number) => `${(Math.min(rate, top) / top) * 100}%`;
  const spoken = sides
    .map(([, label, s]) => `${label}: ${s ? `${percent(s.rate)} of chances broken` : "none counted"}`)
    .join(", ");
  const row = (key: string, label: string, side: Side | null) => (
    <div key={key} data-side={key} className="contents">
      <span className="text-muted-foreground">{label}</span>
      <span className="relative h-4">
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        {side?.low != null && side.high != null && (
          <span
            data-range
            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-foreground opacity-25"
            style={{ left: at(side.low), width: `calc(${at(side.high)} - ${at(side.low)})` }}
          />
        )}
        {side && (
          <span
            data-rate={side.rate}
            className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
            style={{ left: at(side.rate) }}
          />
        )}
      </span>
      <span className="text-right font-mono">{side ? percent(side.rate) : "–"}</span>
    </div>
  );
  return (
    <figure className="m-0 grid gap-1.5">
      <div
        role="img"
        aria-label={spoken}
        className="grid grid-cols-[3.25rem_minmax(0,1fr)_2.5rem] items-center gap-x-2.5 gap-y-2 text-xs"
      >
        {sides.map(([key, label, side]) => row(key, label, side))}
        <span />
        <span data-axis className="relative h-4 font-mono text-muted-foreground">
          {rateTicks(top).map((tick, i, all) => (
            <span
              key={tick}
              className={cn(
                "absolute top-0",
                i === 0 ? "" : i === all.length - 1 ? "-translate-x-full" : "-translate-x-1/2",
              )}
              style={{ left: at(tick) }}
            >
              {percent(tick)}
            </span>
          ))}
        </span>
        <span />
      </div>
      <figcaption className="text-muted-foreground text-xs">
        Share of chances broken, {dayLabel(trial.before?.from ?? trial.started, day)} to the change, then since{" "}
        {dayLabel(trial.started, day)}
      </figcaption>
    </figure>
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
      <Band change={change} status={status} />
      <div className="relative mt-1 h-4 font-mono text-muted-foreground text-xs">
        {end(low, "low", signedPercent(change.low))}
        {end(high, "high", isClipped(change) ? `${signedPercent(change.high)} ›` : signedPercent(change.high))}
      </div>
    </div>
  );
}

/** What the verdict rests on: the days and tasks on each side, and for a rare mistake, its replay. */
function Basis({ trial, day }: { trial: Trial; day: Day }) {
  const facts: [string, string][] = [
    ["Days of real use", `${trial.real_days} of ${REAL_DAYS}`],
    [
      trial.verdict ? "Judged on" : "Verdict due",
      trial.verdict ? dayLabel(trial.due, day) : `${dayLabel(trial.due, day)}, if each day has use`,
    ],
    ["Tasks before", trial.before ? number(trial.before.tasks) : "None"],
    ["Tasks since", trial.after ? number(trial.after.tasks) : "None"],
  ];
  if (trial.verdict) facts.push(["Judged from", trial.source === "replay" ? "Replay" : "Before and since"]);
  if (trial.rare) {
    const replay = trial.replay;
    facts.push([
      "Replay",
      replay === null
        ? "Needed: too rare for 3 days"
        : !replay.trusted
          ? "Can't stand for real agents"
          : replay.change
            ? signedPercent(replay.change.value)
            : "Too few moments",
    ]);
  }
  return <Facts facts={facts} />;
}

/** One rule change in full. Every card has the same sections in the same order; with no verdict, no change. */
export function RuleCard({ row, day }: { row: Row; day: Day }) {
  const { trial } = row;
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
        All rule changes
      </a>
      <section data-section="verdict">
        <h2 className="text-balance font-semibold text-[0.9375rem]">{row.name}</h2>
        {trial.what && <p className="text-muted-foreground text-xs">{trial.what}</p>}
        <p data-verdict className={cn("mt-0.5 font-medium", STATUS_TONE[row.status])}>
          {STATUS_WORDS[row.status]}
        </p>
      </section>
      <Section id="before-after" title="Mistake rate before and since">
        <BeforeAfter trial={trial} day={day} />
      </Section>
      {row.change && (
        <Section id="change" title="Change in mistakes">
          <Change change={row.change} status={row.status} />
        </Section>
      )}
      <Section id="basis" title="What it rests on">
        <Basis trial={trial} day={day} />
      </Section>
      <Section id="hand" title="Hand to an agent">
        {trial.misses.length > 0 && (
          <div data-misses>
            <p className="mb-1 text-muted-foreground text-xs">Latest mistakes</p>
            <Facts facts={trial.misses.map((miss) => [dayLabel(miss.day, day), miss.session, miss.session])} />
          </div>
        )}
        <CopyButton text={() => handText(row, day)}>Copy for an agent</CopyButton>
      </Section>
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
        <p className="mt-0.5 text-muted-foreground text-xs">Pick a rule change to see its evidence.</p>
      </div>
      <Facts
        facts={[
          [`Conversations on ${dayLabel(report.day, report.day)}`, number(report.sessions.total)],
          ["A verdict", `On day ${REAL_DAYS} of real use, never later`],
          ["A day of real use", "Any day someone typed to an agent"],
          ["Compared", "Mistake rate before the change and since"],
          ["Works or Worse", "The whole band on one side of 0"],
          ["A band", "Where the change lies 9 times in 10"],
          ["−63%", "63% fewer mistakes since the change"],
          ["A change that does nothing", "Called Works or Worse about 1 time in 4"],
          ["A rare mistake", "Under 2 chances a day: a replay tests it"],
          ["A rule or skill in red", "Its mistake is above its usual range today"],
          ["Unused", "No use in 30 days: worth trimming"],
          ["A dashed line", "The model most conversations used changed"],
        ]}
      />
    </div>
  );
}
