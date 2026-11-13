import { RangeStrip } from "@/components/change-strip";
import { PairLegend, RatePair } from "@/components/rate-pair";
import { Empty } from "@/components/section";
import type { Day, Replay } from "@/data/report";
import { changeWords } from "@/lib/change";
import { REPLAY_LINE, replayChangeAside, replayFacts, replayHeadline, UNRELIABLE } from "@/lib/details";
import { DetailLayout } from "./detail-layout";

/**
 * A replay in full. Trusted, its verdict, its old → new pair and its change; untrusted, only that it cannot be trusted,
 * with its chart faded and its change said as muted words about the replay, never as an answer.
 */
export function ReplayDetail({ replay, day }: { replay: Replay; day: Day }) {
  const headline = replayHeadline(replay);
  const words = changeWords(replay.change, replay.trusted ? "plain" : "untrusted");
  const below = replay.trusted
    ? words.hint
      ? `${words.lead} · ${words.hint}`
      : words.lead
    : replayChangeAside(replay);
  return (
    <DetailLayout
      kind="Replay"
      title={replay.name}
      headline={headline}
      outlined={headline.outlined}
      line={REPLAY_LINE}
      blocks={[
        {
          caption: replay.trusted ? "Share of moments with the mistake, old wording against new" : UNRELIABLE,
          dim: !replay.trusted,
          node:
            replay.rate_old === null && replay.rate_new === null ? (
              <Empty className="text-sm">No rates to compare</Empty>
            ) : (
              <div className="space-y-3">
                <PairLegend from="old" to="new wording" />
                <RatePair without={replay.rate_old} withRule={replay.rate_new} labelled hollow={!replay.trusted} />
                <RangeStrip change={replay.change} tone={words.tone} same="same as old wording" words={below} />
              </div>
            ),
        },
      ]}
      facts={replayFacts(replay, day)}
    />
  );
}
