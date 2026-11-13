import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { href, PAGES, type Page } from "@/routes";

export function AppSidebar({
  current,
  attention,
  dataUpTo,
  updated,
}: {
  current: Page["id"];
  /** How many items need him, shown beside Overview only when there are any. */
  attention: number;
  dataUpTo: string;
  updated: string;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {PAGES.map((page) => (
                <SidebarMenuItem key={page.id}>
                  <SidebarMenuButton
                    isActive={page.id === current}
                    tooltip={page.title}
                    render={<a href={href(page.id)} />}
                    onClick={() => setOpenMobile(false)}
                  >
                    <page.icon />
                    <span>{page.title}</span>
                  </SidebarMenuButton>
                  {page.id === "overview" && attention > 0 && (
                    <SidebarMenuBadge
                      className="bg-bad text-white peer-hover/menu-button:text-white peer-data-active/menu-button:text-white dark:text-black dark:peer-hover/menu-button:text-black dark:peer-data-active/menu-button:text-black"
                      aria-label={`${attention} need attention`}
                    >
                      {attention}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-4 pb-4 group-data-[collapsible=icon]:hidden">
        <p className="text-sm">{dataUpTo}</p>
        <p className="text-xs text-muted-foreground">{updated}</p>
      </SidebarFooter>
    </Sidebar>
  );
}
