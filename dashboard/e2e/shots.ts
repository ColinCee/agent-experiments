// Saves screenshots of the built page into shots/, named {fixture|report}-{what}-{width}-{theme}.png: the whole page
// at each width, light and dark (wide screens light only), the card for each kind of row, and the phone's card.
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

const KINDS = [
  ["due", '[data-status="due"]'],
  ["judged", '[data-row]:not([data-status="due"])'],
] as const;

/** Every state of a row in the fixture, by name and row. */
const FIXTURE_STATES = [
  ["due", '[data-row="trial-config-read-from-memory"]'],
  ["works", '[data-row="trial-tests-skipped-before-a-commit"]'],
  ["worse", '[data-row="trial-ports-taken-without-checking"]'],
  ["no-effect", '[data-row="trial-commit-messages-with-no-reason"]'],
  ["replayed", '[data-row="trial-replies-with-no-summary-line"]'],
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
      const picks = report === undefined ? FIXTURE_STATES : KINDS;
      for (const [name, selector] of picks) {
        const row = page.locator(selector).first();
        if ((await row.count()) === 0) continue;
        await page.goto(`${opened.url}#${await row.getAttribute("data-row")}`);
        await page.locator("[data-detail]:not([data-detail='page'])").waitFor();
        await page.mouse.move(5, 5);
        await page.waitForTimeout(400);
        await save(page, `card-${name}-${width}-${colorScheme}`, false);
      }
    }
    if (width === "phone") {
      await page.locator("[data-row]").first().click();
      await page.locator("[data-detail]").waitFor();
      await page.waitForTimeout(300);
      await save(page, `card-${width}-${colorScheme}`, false);
    }
    if (opened.errors.length > 0) console.error(`${width} ${colorScheme}: ${opened.errors.join("\n")}`);
    await page.close();
  }
} finally {
  await browser.close();
}
