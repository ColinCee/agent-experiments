import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A titled part of the page, which a link can open the page at (`#/<id>`), with an optional one-line note. */
export function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section id={`section-${id}`} data-section={id} className="scroll-mt-4 space-y-3">
      <div className="space-y-0.5">
        <h2 className="text-base font-semibold">{title}</h2>
        {note && <p className="max-w-prose text-sm text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** A short line standing where a number or list would be, saying why there is none. */
export function Empty({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-muted-foreground", className)}>{children}</p>;
}
