// Saves whole-page screenshots of every page of the built file, at each width, light and dark, into shots/ as
// {fixture|report}-{page}-{width}-{theme}.png, plus the overview's detail sheet open on a phone.
// Usage: pnpm shots [--report path/to/report.json]
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import { PAGES } from "../src/routes.ts";
import { openBuilt, wideWidths, widths } from "./built.ts";

const { values } = parseArgs({ options: { report: { type: "string" } } });
const report = values.report === undefined ? undefined : JSON.parse(await readFile(values.report, "utf8"));
const source = report === undefined ? "fixture" : "report";
const outDir = new URL("../shots/", import.meta.url);
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
try {
  for (const [width, viewport] of Object.entries(widths)) {
    for (const colorScheme of ["light", "dark"] as const) {
      const page = await browser.newPage({ viewport, colorScheme });
      const opened = await openBuilt(page, report);
      for (const { id, path } of PAGES) {
        await page.goto(`${opened.url}#/${path}`);
        const file = fileURLToPath(new URL(`${source}-${id}-${width}-${colorScheme}.png`, outDir));
        // A viewport as tall as the page, not a full-page shot, so the fixed sidebar runs the whole height.
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        await page.setViewportSize({ width: viewport.width, height: Math.max(height, viewport.height) });
        await page.screenshot({ path: file });
        await page.setViewportSize(viewport);
        console.log(file);
      }
      if (width === "phone") {
        // The overview's detail opens in a sheet on a phone: show it open on the first mistake.
        await page.goto(`${opened.url}#/`);
        await page.locator('[data-table="rules"] [data-row], [data-table="no-rule"] [data-row]').first().click();
        await page.getByRole("dialog").waitFor();
        await page.waitForTimeout(300);
        const file = fileURLToPath(new URL(`${source}-overview-sheet-${width}-${colorScheme}.png`, outDir));
        await page.screenshot({ path: file });
        console.log(file);
      }
      if (opened.errors.length > 0) console.error(`${width} ${colorScheme}: ${opened.errors.join("\n")}`);
      await page.close();
    }
  }
  // Wide screens, light only: the pages most at risk of stretching.
  for (const [width, viewport] of Object.entries(wideWidths)) {
    const page = await browser.newPage({ viewport, colorScheme: "light" });
    const opened = await openBuilt(page, report);
    for (const { id, path } of PAGES.filter((p) => p.id === "overview" || p.id === "mistakes")) {
      await page.goto(`${opened.url}#/${path}`);
      const file = fileURLToPath(new URL(`${source}-${id}-${width}-light.png`, outDir));
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
