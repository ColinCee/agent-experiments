import { WordsChart } from "@/components/charts/words-chart";
import type { Day, Sizes } from "@/data/report";
import { onlyAddedLine, SIZE_LINE, sizeHeadline } from "@/lib/details";
import { number } from "@/lib/format";
import { filesOf } from "@/lib/sizes";
import { Caption, DetailLayout } from "./detail-layout";

type Series = Sizes["series"][number];

/** How many of the largest files a set's detail lists. */
const TOP = 5;

/** A thin bar on its own track, under a row of words. */
function Bar({ share, className }: { share: number; className: string }) {
  return (
    <div className="relative h-1.5 rounded-sm bg-muted">
      <div className={`absolute inset-y-0 left-0 rounded-sm ${className}`} style={{ width: `${share * 100}%` }} />
    </div>
  );
}

/** The set's largest files, ranked, each with its words at the right; a bar only when there are several to compare. */
function Largest({ files }: { files: Sizes["largest"] }) {
  const most = Math.max(1, ...files.map((f) => f.words));
  return (
    <section className="space-y-2">
      <Caption>{files.length > 1 ? "Largest files, words" : "Largest file, words"}</Caption>
      <ul className="space-y-2">
        {files.map((f) => (
          <li key={f.file} className="space-y-1">
            <div className="flex justify-between gap-3 text-sm">
              <span className="truncate" title={f.file}>
                {f.file}
              </span>
              <span>{number(f.words)}</span>
            </div>
            {files.length > 1 && <Bar share={f.words / most} className="bg-foreground/70" />}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Per month, the share of edits that only added words, on a 0–100% track. */
function OnlyAdded({ months, day }: { months: Sizes["months"]; day: Day }) {
  return (
    <section className="space-y-2">
      <Caption>Edits that only added words. Lower is better: the rest also cut or rewrote.</Caption>
      <ul className="space-y-2">
        {months.map((m) => (
          <li key={m.month} className="space-y-1">
            <p className="text-sm">{onlyAddedLine(m, day)}</p>
            <Bar share={m.only_added} className="bg-foreground/70" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * One set of files in full: its words now against its first day, how they grew, its largest files, and how often an
 * edit only added words. The files are read by the agent, so every added word costs on every task.
 */
export function SizeDetail({ series, sizes, day }: { series: Series; sizes: Sizes; day: Day }) {
  const files = filesOf(series.label, sizes.largest).slice(0, TOP);
  const months = sizes.months.filter((m) => m.label === series.label);
  return (
    <DetailLayout
      kind="Rule size"
      title={series.label}
      headline={sizeHeadline(series, day)}
      line={SIZE_LINE[series.label]}
      blocks={[{ caption: "Words in the files, by day", node: <WordsChart points={series.points} day={day} /> }]}
      facts={[]}
      more={
        <>
          {files.length > 0 && <Largest files={files} />}
          {months.length > 0 && <OnlyAdded months={months} day={day} />}
        </>
      }
    />
  );
}
