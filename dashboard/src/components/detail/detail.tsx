import type { Report } from "@/data/report";
import type { Row } from "@/lib/rows";
import { MistakeDetail } from "./mistake-detail";
import { PermanentDetail } from "./permanent-detail";
import { ReplayDetail } from "./replay-detail";
import { SizeDetail } from "./size-detail";
import { TrialDetail } from "./trial-detail";

/** The picked row in full, whatever its kind: what the detail panel and the phone's sheet show. */
export function Detail({ row, report }: { row: Row; report: Report }) {
  const day = report.day;
  return (
    <div data-detail={row.id} data-kind={row.kind}>
      {row.kind === "trial" && <TrialDetail trial={row.trial} day={day} />}
      {row.kind === "permanent" && <PermanentDetail check={row.check} day={day} />}
      {row.kind === "mistake" && <MistakeDetail mistake={row.mistake} day={day} />}
      {row.kind === "replay" && <ReplayDetail replay={row.replay} day={day} />}
      {row.kind === "size" && <SizeDetail series={row.series} sizes={report.sizes} day={day} />}
    </div>
  );
}
