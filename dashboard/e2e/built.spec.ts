import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { emptyReport, fixture } from "../src/data/fixture.ts";
import { PAGES } from "../src/routes.ts";
import { builtPage, openBuilt, widths } from "./built.ts";

// Words the page never uses (the design brief's rule 3); "CI" is matched in capitals only.
const BANNED =
  /\b(measures?|settled|holdout|off course|stamped|grouped|sessions?|looks?|effects?|drops?|p-value|confidence interval|bootstrap|kind)\b/i;

const reports = { fixture, empty: emptyReport };

/** Every rate and change track on the page with its marks, measured where they are drawn. */
async function measureTracks(page: Page) {
  return page.evaluate(() => {
    const box = (el: Element) => el.getBoundingClientRect();
    const centre = (el: Element) => box(el).left + box(el).width / 2;
    return (["rate", "change"] as const).map((kind) => ({
      kind,
      tracks: [...document.querySelectorAll(`[data-track="${kind}"]`)].map((track) => ({
        left: box(track).left,
        width: box(track).width,
        marks: [...track.querySelectorAll(kind === "rate" ? "[data-rate]" : "[data-value]")].map((m) => ({
          value: Number(m.getAttribute(kind === "rate" ? "data-rate" : "data-value")),
          x: centre(m),
        })),
      })),
    }));
  });
}

for (const [name, report] of Object.entries(reports)) {
  for (const [width, viewport] of Object.entries(widths)) {
    test(`every page renders cleanly with the ${name} report at ${width} width`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const opened = await openBuilt(page, report);
      for (const { path, title } of PAGES) {
        await page.goto(`${opened.url}#/${path}`);
        await expect(page.locator("header h1")).toHaveText(title);
        // biome-ignore lint/performance/useDomNodeTextContent: only words shown on screen count, not hidden ones.
        const text = await page.locator("body").innerText();
        expect(text, `banned word on ${title}`).not.toMatch(BANNED);
        expect(text).not.toMatch(/\bCI\b/);
        const found = await page.evaluate(() => {
          const small: string[] = [];
          const mono: string[] = [];
          for (const el of document.querySelectorAll("body *")) {
            const style = getComputedStyle(el);
            if (/mono|courier|consolas|menlo/i.test(style.fontFamily)) mono.push(el.tagName);
            const ownText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
            if (ownText && el.getClientRects().length > 0 && Number.parseFloat(style.fontSize) < 12) {
              small.push(`${el.textContent} (${style.fontSize})`);
            }
          }
          return { small, mono, overflow: document.documentElement.scrollWidth - window.innerWidth };
        });
        expect(found.small, `text under 12px on ${title}`).toEqual([]);
        expect(found.mono, `monospace on ${title}`).toEqual([]);
        expect(found.overflow, `horizontal scroll on ${title}`).toBeLessThanOrEqual(0);
      }
      expect(opened.errors).toEqual([]);
      expect(opened.otherRequests()).toEqual([]);
    });
  }
}

for (const [width, viewport] of Object.entries(widths)) {
  test(`rate and change marks share one scale and sit at their value at ${width} width`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const opened = await openBuilt(page);
    let checked = 0;
    for (const path of ["", "trials", "permanent", "replays"]) {
      await page.goto(`${opened.url}#/${path}`);
      for (const { kind, tracks } of await measureTracks(page)) {
        const [first] = tracks;
        for (const track of tracks) {
          expect(Math.abs(track.left - first.left)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(track.width - first.width)).toBeLessThanOrEqual(0.5);
          for (const mark of track.marks) {
            const at = kind === "rate" ? mark.value : (Math.min(1, Math.max(-1, mark.value)) + 1) / 2;
            expect(Math.abs(mark.x - (track.left + at * track.width)), `${kind} ${mark.value}`).toBeLessThanOrEqual(1);
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  test(`history markers sit on their day and the line turns blue at the latest rule at ${width} width`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const opened = await openBuilt(page);
    await page.goto(`${opened.url}#/mistakes`);
    const charts = await page.evaluate(() =>
      [...document.querySelectorAll("[data-slot=card][id]")].map((card) => {
        const x = (el: Element) => el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2;
        const points = [...card.querySelectorAll("circle[data-day]")].map((p) => ({
          day: p.getAttribute("data-day"),
          series: p.getAttribute("data-series"),
          x: x(p),
        }));
        const markers = [...card.querySelectorAll("[data-marker-day]")].map((m) => ({
          day: m.getAttribute("data-marker-day"),
          x: x(m.querySelector("line") as Element),
        }));
        const strokes = [...card.querySelectorAll(".recharts-line-curve")].map((c) => c.getAttribute("stroke"));
        return { id: card.id, points, markers, strokes };
      }),
    );
    let markersChecked = 0;
    for (const mistake of fixture.mistakes) {
      const chart = charts.find((c) => c.id === mistake.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
      if (!chart) throw new Error(`no chart for ${mistake.name}`);
      expect(chart.markers.map((m) => m.day)).toEqual(mistake.changes.map((c) => c.day));
      for (const marker of chart.markers) {
        const point = chart.points.find((p) => p.day === marker.day);
        if (!point) continue; // no data on that day: a gap, not a point
        expect(Math.abs(point.x - marker.x), `${mistake.name} ${marker.day}`).toBeLessThanOrEqual(1);
        markersChecked++;
      }
      const before = chart.points.filter((p) => p.series === "before").map((p) => p.x);
      const after = chart.points.filter((p) => p.series === "after").map((p) => p.x);
      if (mistake.rule === null) {
        expect(after).toEqual([]);
        continue;
      }
      expect(chart.strokes).toEqual(["var(--without)", "var(--with)"]);
      const latest = chart.markers.find((m) => m.day === mistake.rule?.day);
      if (!latest) {
        // The rule is older than the window: the whole line is blue.
        expect(before).toEqual([]);
        continue;
      }
      // Both lines share the change day's point, so the colour switches exactly there.
      expect(Math.abs(Math.max(...before) - latest.x), mistake.name).toBeLessThanOrEqual(1);
      expect(Math.abs(Math.min(...after) - latest.x), mistake.name).toBeLessThanOrEqual(1);
    }
    expect(markersChecked).toBeGreaterThan(5);
  });
}

test("the placeholder appears once, so injection replaces only the report", async () => {
  const html = await readFile(builtPage, "utf8");
  expect(html.split("__REPORT__")).toHaveLength(2);
});

test("an injected report is shown, even with </script> in a name", async ({ page }) => {
  const opened = await openBuilt(page, {
    ...fixture,
    day: "2031-04-05",
    replays: [{ ...fixture.replays[0], name: "A </script> in a name" }],
  });
  await expect(page.getByText("Data up to 5 Apr").first()).toBeVisible();
  await page.goto(`${opened.url}#/replays`);
  await expect(page.getByText("A </script> in a name")).toBeVisible();
  expect(opened.errors).toEqual([]);
});

test("a row on the overview opens that mistake on the tracked mistakes page", async ({ page }) => {
  await page.setViewportSize(widths.desktop);
  await openBuilt(page);
  await page.getByRole("link", { name: /Ports taken without checking/ }).click();
  await expect(page.locator("header h1")).toHaveText("Tracked mistakes");
  await expect(page.locator("#ports-taken-without-checking")).toBeInViewport();
});
