import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { BadgeTone } from "@/lib/change";
import { cn } from "@/lib/utils";

const STYLE: Record<BadgeTone, string> = {
  good: "border-good/30 bg-good/10 text-good",
  bad: "border-bad/30 bg-bad/10 text-bad",
  unclear: "border-border text-muted-foreground",
  waiting: "border-border text-muted-foreground",
};

export function StatusBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <Badge variant="outline" data-tone={tone} className={cn("h-6 px-2.5 text-xs", STYLE[tone])}>
      {tone === "waiting" && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </Badge>
  );
}
