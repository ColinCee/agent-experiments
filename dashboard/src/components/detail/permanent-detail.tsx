import { RangeStrip } from "@/components/change-strip";
import { Empty } from "@/components/section";
import type { Day, PermanentCheck } from "@/data/report";
import { changeWords } from "@/lib/change";
import { PERMANENT_LINE, permanentFacts, permanentHeadline } from "@/lib/details";
import { permanentNote } from "@/lib/permanent";
import { DetailLayout } from "./detail-layout";

/** A proven rule in full: whether it still earns its place, the change it still makes, and its counts. */
export function PermanentDetail({ check, day }: { check: PermanentCheck; day: Day }) {
  const note = permanentNote(check);
  const words = changeWords(check.change, check.slipping ? "slipping" : "plain");
  return (
    <DetailLayout
      kind="Proven rule"
      title={check.name}
      headline={permanentHeadline(check)}
      line={PERMANENT_LINE}
      blocks={[
        {
          caption: "Mistakes with the rule, against without it",
          node:
            note === null ? (
              <RangeStrip
                change={check.change}
                tone={words.tone}
                same="same as without"
                words={words.hint ? `${words.lead} · ${words.hint}` : words.lead}
              />
            ) : (
              <Empty className="text-sm">
                {check.tasks_without === 0 ? "No task has run without the rule yet" : note}
              </Empty>
            ),
        },
      ]}
      facts={permanentFacts(check, day)}
    />
  );
}
