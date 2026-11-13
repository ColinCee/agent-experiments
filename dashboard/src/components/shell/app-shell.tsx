import { type ReactNode, useEffect } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import type { Page } from "@/routes";
import { AppSidebar } from "./app-sidebar";

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
        <header className="flex h-14 items-center gap-2 border-b px-4 md:px-8">
          <SidebarTrigger className="-ml-1" />
          <h1 className="text-lg font-semibold">{page.title}</h1>
          <span className="ml-auto hidden rounded-full border px-2.5 py-0.5 text-sm text-muted-foreground md:inline">
            {dataUpTo}
          </span>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
