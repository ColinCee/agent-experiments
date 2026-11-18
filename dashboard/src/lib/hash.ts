/**
 * The row an address picks, or null. A link is "#<row id>", the only form a published claude.ai page keeps. Links
 * saved from earlier pages still open their row: "#/?m=<row id>" and "#/mistakes/<name>"; a mistake's or replay's
 * link opens the rule or experiment of the same name, and a link to a section that is gone opens the page.
 */
export function pickedRow(hash: string, ids: readonly string[]): string | null {
  const raw = hash.replace(/^#/, "");
  const [location = "", query = ""] = raw.replace(/^\//, "").split("?");
  const [path = "", name] = location.split("/");
  const old = raw.startsWith("/") || raw.includes("?");
  const asked = old
    ? (new URLSearchParams(query).get("m") ?? (path === "mistakes" && name ? `mistake-${name}` : ""))
    : raw;
  if (ids.includes(asked)) return asked;
  const bare = asked.replace(/^(mistake|replay)-/, "");
  return bare === asked ? null : (ids.find((id) => id === `permanent-${bare}` || id === `trial-${bare}`) ?? null);
}

/** The address with `id` picked, or with nothing picked. */
export const rowHref = (id: string | null) => `#${id ?? ""}`;
