// Saves full-page screenshots of the built page at each width into shots/.
// Usage: pnpm shots [--report path/to/report.json]
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import { openBuilt, widths } from "./built.ts";

const { values } = parseArgs({ options: { report: { type: "string" } } });
const report = values.report === undefined ? undefined : JSON.parse(await readFile(values.report, "utf8"));
const outDir = new URL("../shots/", import.meta.url);
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
try {
  for (const [name, size] of Object.entries(widths)) {
    const page = await browser.newPage({ viewport: size });
    const opened = await openBuilt(page, report);
    if (opened.errors.length > 0) console.error(`${name}: ${opened.errors.join("\n")}`);
    const file = fileURLToPath(new URL(`${name}.png`, outDir));
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
  }
} finally {
  await browser.close();
}
