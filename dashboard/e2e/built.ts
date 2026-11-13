// Opens the built single-file page from disk, the way people open the overview, optionally with a report injected
// the way `agent-experiments daily` does it. Run by both Playwright tests and `pnpm shots`, so plain Node must load it.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Page } from "@playwright/test";

export const builtPage = fileURLToPath(new URL("../dist/index.html", import.meta.url));

export const widths = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
};

/** Writes a copy of the built page with `report` in place of the placeholder and returns its path. */
export async function injectReport(report: unknown): Promise<string> {
  const html = await readFile(builtPage, "utf8");
  const json = JSON.stringify(report).replaceAll("</", "<\\/");
  const dir = join(tmpdir(), "agent-experiments-dashboard");
  await mkdir(dir, { recursive: true });
  const file = join(dir, "overview.html");
  await writeFile(
    file,
    html.replace("__REPORT__", () => json),
  );
  return file;
}

/** Opens the built page, or a copy with `report` injected, and collects console errors and non-file requests. */
export async function openBuilt(page: Page, report?: unknown) {
  const file = report === undefined ? builtPage : await injectReport(report);
  const errors: string[] = [];
  const requests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => requests.push(request.url()));
  const url = pathToFileURL(file).href;
  await page.goto(url);
  return { url, errors, otherRequests: () => requests.filter((r) => r !== url) };
}
