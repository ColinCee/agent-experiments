import type { ReactNode } from "react";
import type { Fact, Headline, HeadTone } from "@/lib/details";
import { cn } from "@/lib/utils";

const TONE: Record<HeadTone, string> = { good: "text-good", bad: "text-bad", neutral: "text-foreground" };

export interface Block {
  /** What the chart's axis means, written just above it. */
  caption: string;
  node: ReactNode;
  /** Dimmed, for a result that cannot be trusted. */
  dim?: boolean;
}

/** A small caption above a chart or list, saying what it shows. */
export function Caption({ children }: { children: ReactNode }) {
  return (
    <p data-caption className="text-xs text-muted-foreground">
      {children}
    </p>
  );
}

/** Label left, value right: the panel's facts, in the same shape for every kind of row. */
function Facts({ facts }: { facts: Fact[] }) {
  return (
    <dl data-facts className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-sm">
      {facts.map((fact) => (
        <div key={fact.label} className="contents">
          <dt className="text-muted-foreground">{fact.label}</dt>
          <dd className="text-right">
            {fact.dot && (
              <span
                className={cn(
                  "mr-1.5 inline-block size-2 rounded-full align-middle",
                  fact.dot === "bad" ? "bg-bad" : "bg-good",
                )}
              />
            )}
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The detail panel's one shape, for every kind of row: what kind it is, its name, one big answer, one line on what is
 * compared, its charts each with a caption, and its facts. `under` sits right under the answer (its range), `more`
 * after the facts (lists that belong to one kind).
 */
export function DetailLayout({
  kind,
  title,
  headline,
  outlined = false,
  under,
  line,
  blocks,
  facts,
  more,
}: {
  kind: string;
  title: string;
  headline: Headline;
  outlined?: boolean;
  under?: ReactNode;
  line: string;
  blocks: Block[];
  facts: Fact[];
  more?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="space-y-0.5">
          <p data-kind-label className="text-xs text-muted-foreground">
            {kind}
          </p>
          <h3 className="text-lg leading-snug font-medium">{title}</h3>
        </div>
        <p data-headline className="leading-tight">
          <span
            className={cn(
              "text-2xl font-semibold",
              TONE[headline.tone],
              outlined && "inline-block rounded-md border border-bad/50 px-2 py-0.5",
            )}
          >
            {headline.big}
          </span>
          {headline.rest && <span className="text-muted-foreground"> {headline.rest}</span>}
        </p>
        {under}
        <p data-description className="text-sm text-muted-foreground">
          {line}
        </p>
      </div>
      {blocks.map((block) => (
        <figure key={block.caption} className="space-y-2">
          <Caption>{block.caption}</Caption>
          {/* Only the marks fade: the caption saying why stays readable. */}
          <div className={cn(block.dim && "opacity-60")}>{block.node}</div>
        </figure>
      ))}
      {facts.length > 0 && <Facts facts={facts} />}
      {more}
    </div>
  );
}
