import { type ReactNode, useEffect } from "react";
import { AppShell } from "@/components/shell/app-shell";
import type { Report } from "@/data/report";
import { useRoute } from "@/hooks/use-route";
import { attentionItems, needsHim } from "@/lib/attention";
import { dayLabel, timeLabel } from "@/lib/format";
import { MistakesPage } from "@/pages/mistakes";
import { OverviewPage } from "@/pages/overview";
import { PermanentPage } from "@/pages/permanent";
import { ReplaysPage } from "@/pages/replays";
import { SizesPage } from "@/pages/sizes";
import { TrialsPage } from "@/pages/trials";
import type { Page } from "@/routes";

const PAGE: Record<Page["id"], (props: { report: Report; target: string | null }) => ReactNode> = {
  overview: OverviewPage,
  trials: TrialsPage,
  permanent: PermanentPage,
  mistakes: MistakesPage,
  replays: ReplaysPage,
  sizes: SizesPage,
};

export function App({ report }: { report: Report }) {
  const { page, target } = useRoute();
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new page opens at its top.
  useEffect(() => {
    if (target) document.getElementById(target)?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [page.id, target]);
  const Content = PAGE[page.id];
  return (
    <AppShell
      page={page}
      attention={needsHim(attentionItems(report))}
      dataUpTo={`Data up to ${dayLabel(report.day, report.day)}`}
      updated={`Updated ${timeLabel(report.written)}`}
    >
      <Content report={report} target={target} />
    </AppShell>
  );
}
