import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A titled part of a page. */
export function Section({
  title,
  action,
  children,
  className,
}: {
  title: string;
  /** Shown at the right of the title, such as a link to the page with more. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The one line under a page's title that says what the page is about. */
export function PageIntro({ children }: { children: ReactNode }) {
  return <p className="-mt-2 mb-6 max-w-prose text-muted-foreground">{children}</p>;
}

/** A short line standing where a number or list would be, saying why there is none. */
export function Empty({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-muted-foreground", className)}>{children}</p>;
}
