import { ChangeStrip } from "@/components/change-strip";
import { PairLegend, RatePair } from "@/components/rate-pair";
import { StatusBadge } from "@/components/status-badge";
import type { Day, Replay } from "@/data/report";
import { replayedLine, trustReason, trustWords } from "@/lib/replays";
import { verdictWords } from "@/lib/trials";
import { cn } from "@/lib/utils";

/** A replay in full: when and on how many moments, whether it can be trusted and why, and its result. */
export function ReplayDetail({ replay, day }: { replay: Replay; day: Day }) {
  const words = trustWords(replay);
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-lg leading-snug font-medium">{replay.name}</h3>
        <p className="text-sm text-muted-foreground">{replayedLine(replay, day)}</p>
      </div>
      <div className="space-y-1.5">
        <StatusBadge tone={replay.trusted ? "unclear" : "bad"}>{words.badge}</StatusBadge>
        <p className="text-sm text-muted-foreground">{trustReason(replay)}</p>
      </div>
      <div
        data-trusted={replay.trusted}
        className={cn(
          "-mx-3 space-y-3 rounded-lg border border-transparent p-3",
          !replay.trusted && "border-border border-dashed bg-muted/40",
        )}
      >
        <h4 className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-muted-foreground">{words.heading}</span>
          <span className="font-semibold">{verdictWords(replay.verdict)}</span>
        </h4>
        <PairLegend from="old wording" to="new wording" />
        <RatePair without={replay.rate_old} withRule={replay.rate_new} labelled hollow={!replay.trusted} />
        <ChangeStrip change={replay.change} same="same as old wording" mode={replay.trusted ? "plain" : "untrusted"} />
      </div>
    </div>
  );
}
