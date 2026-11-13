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
  /** The mistake selected on the page (`?m=<slug>`), so a selection survives a reload and can be linked. */
  selected: string | null;
}

/**
 * "#/mistakes/some-name" → the Tracked mistakes page, scrolled to that mistake; "#/?m=some-name" → the overview with
 * that mistake selected; anything unknown is the overview.
 */
export function parseHash(hash: string): Route {
  const [location = "", query = ""] = hash.replace(/^#\/?/, "").split("?");
  const [path = "", target] = location.split("/");
  return {
    page: PAGES.find((p) => p.path === path) ?? PAGES[0],
    target: target || null,
    selected: new URLSearchParams(query).get("m") || null,
  };
}

/** The hash of the overview with `selected` chosen, or with nothing chosen. */
export function selectHref(selected: string | null): string {
  return selected ? `#/?m=${encodeURIComponent(selected)}` : "#/";
}

export function href(id: Page["id"], target?: string): string {
  const page = PAGES.find((p) => p.id === id) ?? PAGES[0];
  return `#/${page.path}${target ? `/${target}` : ""}`;
}
