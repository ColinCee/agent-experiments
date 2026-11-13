import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { Report } from "@/data/report";

export function App({ report }: { report: Report }) {
  return (
    <SidebarProvider>
      <SidebarInset>
        <main className="p-4">
          <h1 data-testid="day">{report.day}</h1>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
