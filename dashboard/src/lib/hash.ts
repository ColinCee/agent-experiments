/** The page's sections, in order; each is also a place a link can open the page at. */
export const SECTIONS = ["attention", "trials", "permanent", "rules", "no-rule", "replays", "size"] as const;

export type SectionId = (typeof SECTIONS)[number];

/** Where a hash points: a section to scroll to and the row picked for the detail panel. */
export interface Place {
  section: SectionId | null;
  selected: string | null;
}

/**
 * Addresses the page used to have still open it at the matching section, so old links keep working:
 * "#/trials", "#/permanent", "#/mistakes" (with "#/mistakes/<name>" picking that mistake), "#/replays" and "#/size".
 */
const OLD_PAGES: Record<string, SectionId> = {
  trials: "trials",
  permanent: "permanent",
  mistakes: "rules",
  replays: "replays",
  size: "size",
  sizes: "size",
};

/** "#/trials" → the trials section; "#/?m=<row>" → that row picked; anything else is the top of the page. */
export function parseHash(hash: string): Place {
  const [location = "", query = ""] = hash.replace(/^#\/?/, "").split("?");
  const [path = "", name] = location.split("/");
  const section = OLD_PAGES[path] ?? (SECTIONS as readonly string[]).find((s) => s === path) ?? null;
  const picked = new URLSearchParams(query).get("m") || null;
  return {
    section: section as SectionId | null,
    selected: picked ?? (path === "mistakes" && name ? `mistake-${name}` : null),
  };
}

/** The hash with `selected` picked, or with nothing picked. */
export function selectHref(selected: string | null): string {
  return selected ? `#/?m=${encodeURIComponent(selected)}` : "#/";
}
