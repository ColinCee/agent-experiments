import { fixture } from "./fixture";
import type { Report } from "./report";

// Matched by shape, not by the literal placeholder: `daily` replaces every copy of the literal in the built file,
// so it may appear only once, inside index.html's report tag.
const UNREPLACED = /^__[A-Z]+__$/;

export function loadReport(): Report {
  const text = document.getElementById("report")?.textContent?.trim() ?? "";
  return UNREPLACED.test(text) ? fixture : (JSON.parse(text) as Report);
}
