import { CircleCheck, CircleDashed, CircleHelp, CircleX } from "lucide-react";
import { STATUS_WORDS, type Status } from "@/lib/status";
import { cn } from "@/lib/utils";

const ICON = { works: CircleCheck, "not-working": CircleX, "cant-tell": CircleHelp, "not-enough": CircleDashed };

/** The page's only colours: a status's icon, number and band all take its tone. */
export const STATUS_TONE: Record<Status, string> = {
  works: "text-good",
  "not-working": "text-bad",
  "cant-tell": "text-unsure",
  "not-enough": "text-muted-foreground",
};

/** Pass `decorative` when the status is written beside the icon. */
export function StatusIcon({ status, decorative = false }: { status: Status; decorative?: boolean }) {
  const Icon = ICON[status];
  return (
    <Icon
      data-status-icon={status}
      className={cn("size-4 shrink-0", STATUS_TONE[status])}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": STATUS_WORDS[status] })}
    />
  );
}
