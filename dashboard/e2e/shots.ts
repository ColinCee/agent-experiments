// Saves screenshots of the built page into shots/, named {fixture|report}-{what}-{width}-{theme}.png: the whole page
// at each width, light and dark (wide screens light only), the detail panel for each kind of row, and the phone's
// sheet open.
// Usage: pnpm shots [--report path/to/report.json]
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium, type Page } from "@playwright/test";
import { openBuilt, wideWidths, widths } from "./built.ts";

const { values } = parseArgs({ options: { report: { type: "string" } } });
const report = values.report === undefined ? undefined : JSON.parse(await readFile(values.report, "utf8"));
const source = report === undefined ? "fixture" : "report";
const outDir = new URL("../shots/", import.meta.url);
await mkdir(outDir, { recursive: true });

const KINDS = ["trial", "permanent", "mistake", "replay", "size"];

/** Every state of every kind of row in the fixture, by name and row. */
const FIXTURE_STATES = [
  ["trial-scheduled", '[data-row="trial-screenshots-sent-without-a-link"]'],
  ["trial-running", '[data-row="trial-config-read-from-memory"]'],
  ["trial-finished", '[data-row="trial-tests-skipped-before-a-commit"]'],
  ["permanent-working", '[data-row="permanent-replies-with-no-summary-line"]'],
  ["permanent-slipping", '[data-row="permanent-drafts-saved-in-the-wrong-folder"]'],
  ["permanent-waiting", '[data-row="permanent-branch-pushed-without-a-pull-request"]'],
  ["mistake-sure", '[data-row="mistake-replies-with-no-summary-line"]'],
  ["mistake-unclear", '[data-row="mistake-questions-asked-that-the-notes-answer"]'],
  ["mistake-no-rule", '[data-row="mistake-old-branches-left-open"]'],
  ["replay-trusted", '[data-row="replay-replies-with-no-summary-line"]'],
  ["replay-untrusted", '[data-row="replay-ports-taken-without-checking"]'],
  ["size-rules", '[data-row="size-rules"]'],
  ["size-skills", '[data-row="size-skills"]'],
] as const;

async function save(page: Page, name: string, whole: boolean) {
  const file = fileURLToPath(new URL(`${source}-${name}.png`, outDir));
  if (whole) {
    // A viewport as tall as the page, not a full-page shot, so a sticky panel is drawn where it really stays.
    const viewport = page.viewportSize() ?? widths.desktop;
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: viewport.width, height: Math.max(height, viewport.height) });
    await page.screenshot({ path: file });
    await page.setViewportSize(viewport);
  } else {
    await page.screenshot({ path: file });
  }
  console.log(file);
}

const browser = await chromium.launch();
try {
  const sizes = [
    ...Object.entries(widths).flatMap(([w, v]) => (["light", "dark"] as const).map((t) => [w, v, t] as const)),
    ...Object.entries(wideWidths).map(([w, v]) => [w, v, "light"] as const),
  ];
  for (const [width, viewport, colorScheme] of sizes) {
    const page = await browser.newPage({ viewport, colorScheme });
    const opened = await openBuilt(page, report);
    await save(page, `page-${width}-${colorScheme}`, true);
    if (width === "desktop" && colorScheme === "light") {
      // The fixture shoots every state of every kind; a real report, the first row of each kind.
      const picks =
        report === undefined ? FIXTURE_STATES : KINDS.map((kind) => [kind, `[data-row^="${kind}-"]`] as const);
      for (const [name, selector] of picks) {
        const row = page.locator(selector).first();
        if ((await row.count()) === 0) continue;
        await row.locator("[data-name]").click();
        await page.locator("[data-detail]").waitFor();
        // Scrolled so the picked row and the panel are both in view.
        await row.evaluate((el) => el.scrollIntoView({ block: "center" }));
        await save(page, `panel-${name}-${width}-${colorScheme}`, false);
      }
    }
    if (width === "phone") {
      await page.locator("[data-row]").first().click();
      await page.getByRole("dialog").waitFor();
      await page.waitForTimeout(300);
      await save(page, `sheet-${width}-${colorScheme}`, false);
    }
    if (opened.errors.length > 0) console.error(`${width} ${colorScheme}: ${opened.errors.join("\n")}`);
    await page.close();
  }
} finally {
  await browser.close();
}
