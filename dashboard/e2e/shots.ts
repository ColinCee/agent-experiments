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
      for (const kind of KINDS) {
        const row = page.locator(`[data-row^="${kind}-"]`).first();
        if ((await row.count()) === 0) continue;
        await row.click();
        await page.locator(`[data-detail^="${kind}-"]`).waitFor();
        await page.evaluate(() => window.scrollTo(0, 0));
        await save(page, `panel-${kind}-${width}-${colorScheme}`, false);
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
