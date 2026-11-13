import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { fixture } from "../src/data/fixture.ts";
import { builtPage, openBuilt, widths } from "./built.ts";

for (const [name, size] of Object.entries(widths)) {
  test(`the built page opens from disk at ${name} width`, async ({ page }) => {
    await page.setViewportSize(size);
    const opened = await openBuilt(page);
    await expect(page.getByTestId("day")).toHaveText(fixture.day);
    expect(opened.errors).toEqual([]);
    expect(opened.otherRequests()).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("the placeholder appears once, so injection replaces only the report", async () => {
  const html = await readFile(builtPage, "utf8");
  expect(html.split("__REPORT__")).toHaveLength(2);
});

test("an injected report is shown", async ({ page }) => {
  const opened = await openBuilt(page, {
    ...fixture,
    day: "2031-04-05",
    replays: [{ ...fixture.replays[0], name: "</script> in a name" }],
  });
  await expect(page.getByTestId("day")).toHaveText("2031-04-05");
  expect(opened.errors).toEqual([]);
});
