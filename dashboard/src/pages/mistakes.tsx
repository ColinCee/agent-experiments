import { MistakeDetail } from "@/components/mistake-detail";
import { Empty, PageIntro, Section } from "@/components/section";
import { Card, CardContent } from "@/components/ui/card";
import type { Day, Mistake, Report } from "@/data/report";
import { slug, withoutRule, withRule } from "@/lib/mistakes";
import { cn } from "@/lib/utils";

function MistakeCard({ mistake, day, target }: { mistake: Mistake; day: Day; target: boolean }) {
  return (
    <Card id={slug(mistake.name)} className={cn("scroll-mt-4", target && "ring-2 ring-foreground/40")}>
      <CardContent>
        <MistakeDetail mistake={mistake} day={day} />
      </CardContent>
    </Card>
  );
}

function Group({
  title,
  mistakes,
  day,
  target,
}: {
  title: string;
  mistakes: Mistake[];
  day: Day;
  target: string | null;
}) {
  if (mistakes.length === 0) return null;
  return (
    <Section title={title}>
      <div className="grid gap-4 xl:grid-cols-2">
        {mistakes.map((m) => (
          <MistakeCard key={m.name} mistake={m} day={day} target={slug(m.name) === target} />
        ))}
      </div>
    </Section>
  );
}

export function MistakesPage({ report, target }: { report: Report; target: string | null }) {
  return (
    <>
      <PageIntro>Share of chances where the mistake happened, 3-day average.</PageIntro>
      {report.mistakes.length === 0 ? (
        <Empty>No mistakes are tracked yet</Empty>
      ) : (
        <div className="space-y-10">
          <Group title="With a rule" mistakes={withRule(report.mistakes)} day={report.day} target={target} />
          <Group title="No rule yet" mistakes={withoutRule(report.mistakes)} day={report.day} target={target} />
        </div>
      )}
    </>
  );
}
