import { AlignWithStrip, ChangeStrip } from "@/components/change-strip";
import { RatePair, RateValue, Swatch } from "@/components/rate-pair";
import { Empty, PageIntro } from "@/components/section";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Day, Replay, Report } from "@/data/report";
import { percent } from "@/lib/format";
import { replayedLine, trustReason, trustWords } from "@/lib/replays";
import { verdictWords } from "@/lib/trials";
import { cn } from "@/lib/utils";

const rate = (r: number | null) => (r === null ? "–" : percent(r));

function ReplayCard({ replay, day, axis }: { replay: Replay; day: Day; axis: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{replay.name}</CardTitle>
        <p className="text-sm text-muted-foreground">{replayedLine(replay, day)}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <StatusBadge tone={replay.trusted ? "unclear" : "bad"}>{trustWords(replay).badge}</StatusBadge>
          <p className="text-sm text-muted-foreground">{trustReason(replay)}</p>
        </div>
        <div
          data-trusted={replay.trusted}
          className={cn(
            "-mx-3 space-y-3 rounded-lg border border-transparent p-3",
            !replay.trusted && "border-border border-dashed bg-muted/40",
          )}
        >
          <h3 className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-muted-foreground">{trustWords(replay).heading}</span>
            <span className="font-semibold">{verdictWords(replay.verdict)}</span>
          </h3>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
            <Swatch side="without">
              Old wording <RateValue rate={rate(replay.rate_old)} side="without" />
            </Swatch>
            <Swatch side="with">
              New wording <RateValue rate={rate(replay.rate_new)} side="with" />
            </Swatch>
          </div>
          <AlignWithStrip>
            <RatePair without={replay.rate_old} withRule={replay.rate_new} />
          </AlignWithStrip>
          <ChangeStrip change={replay.change} axis={axis} mode={replay.trusted ? "plain" : "untrusted"} />
        </div>
      </CardContent>
    </Card>
  );
}

export function ReplaysPage({ report }: { report: Report }) {
  return (
    <>
      <PageIntro>A replay answers past moments again under the old and the new wording of a rule.</PageIntro>
      {report.replays.length === 0 ? (
        <Empty>No replays yet</Empty>
      ) : (
        <div className="space-y-6">
          {report.replays.map((r, i) => (
            <ReplayCard key={`${r.name} ${r.day}`} replay={r} day={report.day} axis={i === 0} />
          ))}
        </div>
      )}
    </>
  );
}
