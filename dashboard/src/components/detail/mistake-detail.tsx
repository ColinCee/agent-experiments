import { RangeStrip } from "@/components/change-strip";
import { HistoryChart } from "@/components/charts/history-chart";
import { Empty } from "@/components/section";
import type { Day, Mistake } from "@/data/report";
import { changeWords } from "@/lib/change";
import { mistakeFacts, mistakeHeadline, mistakeLine } from "@/lib/details";
import { missingMistakeChange } from "@/lib/mistakes";
import { DetailLayout } from "./detail-layout";

/** A mistake in full: its change since the rule with its range, its history, and the facts behind them. */
export function MistakeDetail({ mistake, day }: { mistake: Mistake; day: Day }) {
  const words = changeWords(mistake.change, "plain", missingMistakeChange(mistake));
  const hasData = mistake.series.some((p) => p.rate !== null);
  return (
    <DetailLayout
      kind="Mistake"
      title={mistake.name}
      headline={mistakeHeadline(mistake)}
      under={
        mistake.rule &&
        words.hasRange && (
          <RangeStrip change={mistake.change} tone={words.tone} same="same as before" words={words.hint} />
        )
      }
      line={mistakeLine(mistake, day)}
      blocks={[
        {
          caption: "Share of tasks with this mistake, 3-day average",
          node: hasData ? (
            <HistoryChart mistake={mistake} day={day} />
          ) : (
            <Empty className="text-sm">No chances for this mistake in the last 6 weeks</Empty>
          ),
        },
      ]}
      facts={mistakeFacts(mistake, day)}
    />
  );
}
