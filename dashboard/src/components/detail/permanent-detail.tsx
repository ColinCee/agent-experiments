import { ChangeStrip } from "@/components/change-strip";
import { StatusBadge } from "@/components/status-badge";
import type { Day, PermanentCheck } from "@/data/report";
import { dayLabel, number } from "@/lib/format";
import { permanentNote, permanentStatus, SLIPPING_LINE, STATUS_TONE, STATUS_WORDS } from "@/lib/permanent";

/** A proven rule in full: since when it is checked and on which model, its tasks, and the change it still makes. */
export function PermanentDetail({ check, day }: { check: PermanentCheck; day: Day }) {
  const status = permanentStatus(check);
  const note = permanentNote(check);
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-lg leading-snug font-medium">{check.name}</h3>
        <StatusBadge tone={STATUS_TONE[status]}>{STATUS_WORDS[status]}</StatusBadge>
      </div>
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>
          Checked since {dayLabel(check.since, day)}
          {check.model && ` on ${check.model}`}
        </p>
        <p>
          {number(check.tasks_without)} tasks without the rule · {number(check.tasks_with)} with it
        </p>
      </div>
      {note === null ? (
        <ChangeStrip change={check.change} same="same as without" mode={check.slipping ? "slipping" : "plain"} />
      ) : (
        <p className="text-muted-foreground">{note}</p>
      )}
      {check.slipping && <p className="text-sm">{SLIPPING_LINE}</p>}
    </div>
  );
}
