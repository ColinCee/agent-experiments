// Saves full-page screenshots of every page of the built file, at each width, light and dark, into shots/ as
// {fixture|report}-{page}-{width}-{theme}.png.
// Usage: pnpm shots [--report path/to/report.json]
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import { PAGES } from "../src/routes.ts";
import { openBuilt, widths } from "./built.ts";

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
        await page.screenshot({ path: file, fullPage: true });
        console.log(file);
      }
      if (opened.errors.length > 0) console.error(`${width} ${colorScheme}: ${opened.errors.join("\n")}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
