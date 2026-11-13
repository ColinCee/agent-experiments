import {
  Activity,
  FileText,
  FlaskConical,
  LayoutDashboard,
  type LucideIcon,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

export interface Page {
  id: "overview" | "trials" | "permanent" | "mistakes" | "replays" | "sizes";
  path: string;
  title: string;
  icon: LucideIcon;
}

export const PAGES: Page[] = [
  { id: "overview", path: "", title: "Overview", icon: LayoutDashboard },
  { id: "trials", path: "trials", title: "Trials", icon: FlaskConical },
  { id: "permanent", path: "permanent", title: "Permanent check", icon: ShieldCheck },
  { id: "mistakes", path: "mistakes", title: "Tracked mistakes", icon: Activity },
  { id: "replays", path: "replays", title: "Replays", icon: RotateCcw },
  { id: "sizes", path: "sizes", title: "Rule size", icon: FileText },
];

export interface Route {
  page: Page;
  /** What on the page to scroll to, such as one mistake. */
  target: string | null;
}

/** "#/mistakes/some-name" → the Tracked mistakes page, scrolled to that mistake; anything unknown is the overview. */
export function parseHash(hash: string): Route {
  const [path = "", target] = hash.replace(/^#\/?/, "").split("/");
  return { page: PAGES.find((p) => p.path === path) ?? PAGES[0], target: target || null };
}

export function href(id: Page["id"], target?: string): string {
  const page = PAGES.find((p) => p.id === id) ?? PAGES[0];
  return `#/${page.path}${target ? `/${target}` : ""}`;
}
