import { Button } from "@/components/ui/button";
import { STATUS_WORDS, STATUSES, type Status } from "@/lib/status";
import { StatusIcon } from "./status-icon";

/** Pointing at a pill, or moving focus to it, lights its rows; a click keeps only them, and a second shows all. */
export function Pills({
  counts,
  filter,
  onLight,
  onFilter,
}: {
  counts: Record<Status, number>;
  filter: Status | null;
  onLight: (status: Status | null) => void;
  onFilter: (status: Status) => void;
}) {
  return (
    <fieldset aria-label="Show only" className="m-0 flex min-w-0 flex-wrap gap-1.5 border-0 p-0">
      {STATUSES.map((status) => (
        <Button
          key={status}
          variant={filter === status ? "secondary" : "outline"}
          size="sm"
          data-pill={status}
          aria-pressed={filter === status}
          disabled={counts[status] === 0}
          className="rounded-full motion-safe:active:scale-95"
          // A touch fires pointerenter with no leave to follow, which would leave the rows dimmed.
          onPointerEnter={(event) => event.pointerType === "mouse" && onLight(status)}
          onPointerLeave={() => onLight(null)}
          onFocus={(event) => event.currentTarget.matches(":focus-visible") && onLight(status)}
          onBlur={() => onLight(null)}
          onClick={() => onFilter(status)}
        >
          <StatusIcon status={status} decorative />
          {STATUS_WORDS[status]}
          <span className="font-mono text-muted-foreground">{counts[status]}</span>
        </Button>
      ))}
    </fieldset>
  );
}
