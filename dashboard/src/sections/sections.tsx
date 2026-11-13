import { CircleCheck } from "lucide-react";
import { ChangeMarks } from "@/components/change-strip";
import { RateBar, RatePair, STRIP_GUTTER } from "@/components/rate-pair";
import { Section } from "@/components/section";
import { Sparkline } from "@/components/sparkline";
import type { Report } from "@/data/report";
import { type AttentionItem, attentionItems, calmLine } from "@/lib/attention";
import { changeTone } from "@/lib/change";
import { plural } from "@/lib/format";
import { NO_RECENT_TASKS, scoreWords } from "@/lib/mistakes";
import { permanentRowNote, permanentStatus, permanentSummary, STATUS_TONE, STATUS_WORDS } from "@/lib/permanent";
import { replayResult } from "@/lib/replays";
import type { Row } from "@/lib/rows";
import { wordsAdded } from "@/lib/sizes";
import { trialRow } from "@/lib/trials";
import { cn } from "@/lib/utils";
import { PairHeader, RateHeader, SparkHeader, StripHeader } from "./legends";
import { type Picking, Reason, Result, RowsSection } from "./rows-section";

const TINT: Record<AttentionItem["tone"], string> = {
  bad: "border-bad/30 bg-bad/8",
  good: "border-good/30 bg-good/8",
  neutral: "border-border",
};

/** What needs him first: one card per item, each picking the row it is about; or one calm line. */
function Attention({ report, picking }: { report: Report; picking: Picking }) {
  const items = attentionItems(report);
  return (
    <Section id="attention" title="Needs attention">
      {items.length === 0 ? (
        <p data-block className="flex items-start gap-2 text-muted-foreground">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-good" />
          <span className="max-w-prose">{calmLine(report.day)}</span>
        </p>
      ) : (
        <ul data-block className="grid gap-3 @3xl:grid-cols-2">
          {items.map((item) => (
            <li key={`${item.title} ${item.detail}`}>
              <button
                type="button"
                data-attention={item.target}
                onClick={() => picking.onSelect(item.target)}
                className={cn(
                  "w-full rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/50",
                  TINT[item.tone],
                  picking.selected === item.target && "ring-2 ring-foreground/40",
                )}
              >
                <span className="block font-medium">{item.title}</span>
                <span className="block text-sm text-muted-foreground">{item.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** Rows of one section, picked out of the page's rows. */
const inSection = (rows: Row[], id: Row["section"]) => rows.filter((r) => r.section === id);

/** Every section of the page, in order, on one grid so all their charts share one column. */
export function Sections({ report, rows, picking }: { report: Report; rows: Row[]; picking: Picking }) {
  const day = report.day;
  return (
    <>
      <Attention report={report} picking={picking} />
      <RowsSection
        id="trials"
        title="Trials"
        heads={{ name: "Trial", result: "Result" }}
        legend={<PairHeader from="without the rule" to="with the rule" />}
        rows={inSection(rows, "trials")}
        empty="No trials yet"
        picking={picking}
        cells={(row) => {
          if (row.kind !== "trial") return { chart: null, result: null };
          const t = row.trial;
          const words = trialRow(t, day);
          return {
            chart: words.reason ? (
              <Reason>{words.reason}</Reason>
            ) : (
              <RatePair without={t.rate_without} withRule={t.rate_with} labelled />
            ),
            result: <Result tone={words.tone}>{words.result}</Result>,
          };
        }}
      />
      <RowsSection
        id="permanent"
        title="Permanent check"
        note={permanentSummary(report.permanent, day)}
        heads={{ name: "Proven rule", result: "Status" }}
        legend={<StripHeader title="change with the rule" same="same as without" />}
        rows={inSection(rows, "permanent")}
        empty="No proven rules yet"
        picking={picking}
        cells={(row) => {
          if (row.kind !== "permanent") return { chart: null, result: null };
          const check = row.check;
          const note = permanentRowNote(check);
          const status = permanentStatus(check);
          return {
            chart:
              note === null ? (
                <div className={STRIP_GUTTER}>
                  <ChangeMarks change={check.change} tone={check.slipping ? "bad" : changeTone(check.change)} />
                </div>
              ) : (
                <Reason>{note}</Reason>
              ),
            result: (
              <Result tone={status === "nothing" ? "waiting" : STATUS_TONE[status]}>{STATUS_WORDS[status]}</Result>
            ),
          };
        }}
      />
      <RowsSection
        id="rules"
        title="Rules and their mistakes"
        heads={{ name: "Mistake", result: "Change" }}
        legend={<PairHeader from="before the rule" to="since" />}
        rows={inSection(rows, "rules")}
        empty="No rule has been tried on a mistake yet"
        picking={picking}
        cells={(row) => {
          if (row.kind !== "mistake") return { chart: null, result: null };
          const m = row.mistake;
          const words = scoreWords(m);
          return {
            chart: <RatePair without={m.before?.rate ?? null} withRule={m.after?.rate ?? null} labelled />,
            result: <Result tone={words.hasRange ? words.tone : "waiting"}>{words.lead}</Result>,
          };
        }}
      />
      <RowsSection
        id="no-rule"
        title="Mistakes with no rule yet"
        heads={{ name: "Mistake", result: "Tasks" }}
        legend={<RateHeader title="rate now" />}
        rows={inSection(rows, "no-rule")}
        empty="Every tracked mistake has a rule"
        picking={picking}
        cells={(row) => {
          if (row.kind !== "mistake") return { chart: null, result: null };
          const current = row.mistake.current;
          return current
            ? {
                chart: <RateBar rate={current.rate} />,
                result: <Result tone="waiting">{plural(current.tasks, "task")}</Result>,
              }
            : { chart: <Reason>{NO_RECENT_TASKS}</Reason>, result: null };
        }}
      />
      <RowsSection
        id="replays"
        title="Replays"
        heads={{ name: "Replay", result: "Result" }}
        legend={<PairHeader from="old wording" to="new wording" />}
        rows={inSection(rows, "replays")}
        empty="No replays yet"
        picking={picking}
        cells={(row) => {
          if (row.kind !== "replay") return { chart: null, result: null };
          const r = row.replay;
          const result = replayResult(r);
          return {
            chart:
              r.rate_old === null && r.rate_new === null ? (
                <Reason>No rates to compare</Reason>
              ) : (
                <RatePair without={r.rate_old} withRule={r.rate_new} labelled hollow={!r.trusted} />
              ),
            // "Can't be trusted" in the smaller size, so it fits the column on one line.
            result: (
              <Result tone={result.tone} small={!r.trusted}>
                {result.text}
              </Result>
            ),
          };
        }}
      />
      <RowsSection
        id="size"
        title="Rule size"
        heads={{ name: "Files", result: "Added" }}
        legend={<SparkHeader title="words, first day → latest" />}
        rows={inSection(rows, "size")}
        empty="No rule or skill files measured yet"
        picking={picking}
        cells={(row) => {
          if (row.kind !== "size") return { chart: null, result: null };
          return {
            chart: <Sparkline points={row.series.points} />,
            result: <Result tone="waiting">{wordsAdded(row.series)}</Result>,
          };
        }}
      />
    </>
  );
}
