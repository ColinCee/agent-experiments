import { WordsChart } from "@/components/charts/words-chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Day, Sizes } from "@/data/report";
import { monthLabel, number, percent } from "@/lib/format";
import { filesOf, growthWords } from "@/lib/sizes";

type Series = Sizes["series"][number];

function Largest({ files }: { files: Sizes["largest"] }) {
  const most = Math.max(1, ...files.map((f) => f.words));
  return (
    <ul className="space-y-2">
      {files.map((f) => (
        <li key={f.file} className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-3 gap-y-1">
          <span className="truncate text-sm" title={f.file}>
            {f.file}
          </span>
          <span className="text-right text-sm">{number(f.words)}</span>
          <div className="relative col-span-2 h-2 rounded-sm bg-muted">
            <div
              className="absolute inset-y-0 left-0 rounded-sm bg-foreground/70"
              style={{ width: `${(f.words / most) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Months({ months, day }: { months: Sizes["months"]; day: Day }) {
  return (
    <Table className="[&_th]:h-auto [&_th]:py-2 [&_th]:align-bottom">
      <TableHeader>
        <TableRow>
          <TableHead>Month</TableHead>
          <TableHead className="text-right">Edits</TableHead>
          <TableHead className="text-right whitespace-normal">Edits that only added text</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {months.map((m) => (
          <TableRow key={m.month}>
            <TableCell>{monthLabel(m.month, day)}</TableCell>
            <TableCell className="text-right">{number(m.changes)}</TableCell>
            <TableCell className="text-right">{percent(m.only_added)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** One set of files in full: its words now and over time, its largest files, and how edits change it by month. */
export function SizeDetail({ series, sizes, day }: { series: Series; sizes: Sizes; day: Day }) {
  const files = filesOf(series.label, sizes.largest);
  const months = sizes.months.filter((m) => m.label === series.label);
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg leading-snug font-medium">{series.label}</h3>
        <p className="text-3xl font-semibold">
          {number(series.now)} <span className="text-base font-normal text-muted-foreground">words</span>
        </p>
        <p className="text-sm text-muted-foreground">{growthWords(series, day)}</p>
      </div>
      <WordsChart points={series.points} day={day} />
      {files.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-sm font-medium">Largest files</h4>
          <Largest files={files} />
        </section>
      )}
      {months.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-sm font-medium">How edits change them</h4>
          <p className="text-sm text-muted-foreground">
            A high share of edits that only add text means the files only grow.
          </p>
          <Months months={months} day={day} />
        </section>
      )}
    </div>
  );
}
