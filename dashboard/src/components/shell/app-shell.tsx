import { type ReactNode, useEffect } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { Page } from "@/routes";
import { AppSidebar } from "./app-sidebar";

/** How fresh the data is, in the header only while the sidebar's footer, which says it too, is out of sight. */
function DataChip({ children }: { children: string }) {
  const { isMobile, state } = useSidebar();
  if (!isMobile && state === "expanded") return null;
  return <span className="ml-auto rounded-full border px-2.5 py-0.5 text-sm text-muted-foreground">{children}</span>;
}

/** The overview, with its detail panel, keeps a little more width for names on a laptop screen. */
const PADDING: Record<Page["id"], string> = {
  overview: "px-4 md:px-6",
  trials: "px-4 md:px-8",
  permanent: "px-4 md:px-8",
  mistakes: "px-4 md:px-8",
  replays: "px-4 md:px-8",
  sizes: "px-4 md:px-8",
};

/** The sidebar, the page header (title left, how fresh the data is right) and the page itself. */
export function AppShell({
  page,
  attention,
  dataUpTo,
  updated,
  children,
}: {
  page: Page;
  attention: number;
  dataUpTo: string;
  updated: string;
  children: ReactNode;
}) {
  useEffect(() => {
    document.title = `${page.title} · Agent experiments`;
  }, [page]);
  return (
    <SidebarProvider>
      <AppSidebar current={page.id} attention={attention} dataUpTo={dataUpTo} updated={updated} />
      <SidebarInset className="min-w-0">
        {/* Header and page share one frame, centred in the space right of the sidebar. */}
        <header className={cn("border-b", PADDING[page.id])}>
          <div className="mx-auto flex h-14 w-full items-center gap-2" style={{ maxWidth: page.frame }}>
            <SidebarTrigger className="-ml-1" />
            <h1 className="text-lg font-semibold">{page.title}</h1>
            <DataChip>{dataUpTo}</DataChip>
          </div>
        </header>
        <main className={cn("py-6 md:py-8", PADDING[page.id])}>
          <div data-frame className="mx-auto w-full" style={{ maxWidth: page.frame }}>
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
