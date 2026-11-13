import { WordsChart } from "@/components/charts/words-chart";
import { Empty, Section } from "@/components/section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Day, Report, Sizes } from "@/data/report";
import { monthLabel, number, percent } from "@/lib/format";
import { growthWords } from "@/lib/sizes";

function Stat({ series, day }: { series: Sizes["series"][number]; day: Day }) {
  return (
    <Card>
      <CardContent className="space-y-1">
        <p className="text-sm text-muted-foreground">{series.label}</p>
        <p className="text-3xl font-semibold">
          {number(series.now)} <span className="text-base font-normal text-muted-foreground">words</span>
        </p>
        <p className="text-sm text-muted-foreground">{growthWords(series, day)}</p>
      </CardContent>
    </Card>
  );
}

function Largest({ files }: { files: Sizes["largest"] }) {
  const most = Math.max(1, ...files.map((f) => f.words));
  return (
    <ul className="space-y-2">
      {files.map((f) => (
        <li
          key={f.file}
          className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_3.5rem]"
        >
          <span className="truncate text-sm" title={f.file}>
            {f.file}
          </span>
          <div className="relative order-last col-span-2 h-2.5 rounded-sm bg-muted sm:order-none sm:col-span-1">
            <div
              className="absolute inset-y-0 left-0 rounded-sm bg-foreground/70"
              style={{ width: `${(f.words / most) * 100}%` }}
            />
          </div>
          <span className="text-right text-sm">{number(f.words)}</span>
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
          <TableHead className="whitespace-normal">Month</TableHead>
          <TableHead className="whitespace-normal">Rules or Skills</TableHead>
          <TableHead className="text-right whitespace-normal">Edits</TableHead>
          <TableHead className="text-right whitespace-normal">Only added text</TableHead>
          <TableHead className="text-right whitespace-normal">Of changed lines, added</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {months.map((m) => (
          <TableRow key={`${m.month} ${m.label}`}>
            <TableCell>{monthLabel(m.month, day)}</TableCell>
            <TableCell>{m.label}</TableCell>
            <TableCell className="text-right">{number(m.changes)}</TableCell>
            <TableCell className="text-right">{percent(m.only_added)}</TableCell>
            <TableCell className="text-right">{percent(m.added_share)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function SizesPage({ report }: { report: Report }) {
  const { series, largest, months } = report.sizes;
  return (
    <div className="space-y-10">
      {series.length === 0 ? (
        <Empty>No rule or skill files measured yet</Empty>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {series.map((s) => (
              <Stat key={s.label} series={s} day={report.day} />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {series.map((s) => (
              <Card key={s.label}>
                <CardHeader>
                  <CardTitle>{s.label}, words</CardTitle>
                </CardHeader>
                <CardContent>
                  <WordsChart points={s.points} day={report.day} />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
      {largest.length > 0 && (
        <Section title="Largest files">
          <Largest files={largest} />
        </Section>
      )}
      {months.length > 0 && (
        <Section title="How edits change them">
          <p className="text-sm text-muted-foreground">
            A high share of edits that only add text means the files only grow.
          </p>
          <Months months={months} day={report.day} />
        </Section>
      )}
    </div>
  );
}
