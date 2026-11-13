import { fixture } from "./fixture";
import type { Report } from "./report";

// Matched by shape, not by the literal placeholder, so the placeholder appears only once in the built file: `daily`
// replaces only the copy in the report tag.
const UNREPLACED = /^__[A-Z]+__$/;

export function loadReport(): Report {
  const text = document.getElementById("report")?.textContent?.trim() ?? "";
  return UNREPLACED.test(text) ? fixture : (JSON.parse(text) as Report);
}
