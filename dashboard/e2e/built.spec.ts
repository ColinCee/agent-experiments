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
      // A strip's captions (in a table's header row or over a card's strip) must line up with the strips too.
      tracks: [
        ...document.querySelectorAll(
          kind === "rate" ? '[data-track="rate"], [data-scale]' : '[data-track="change"], [data-axis]',
        ),
      ]
        .filter((track) => box(track).width > 0)
        .map((track) => ({
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

  test(`history marker labels neither overlap nor run off the chart at ${width} width`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const opened = await openBuilt(page);
    await page.goto(`${opened.url}#/mistakes`);
    const charts = await page.evaluate(() =>
      [...document.querySelectorAll("[data-slot=chart]")].map((chart) => {
        const surface = chart.querySelector(".recharts-surface")?.getBoundingClientRect();
        const labels = [...chart.querySelectorAll("[data-marker-label]")].map((l) => {
          const r = l.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        });
        return { surface: surface && { left: surface.left, right: surface.right, top: surface.top }, labels };
      }),
    );
    let labels = 0;
    for (const { surface, labels: boxes } of charts) {
      if (!surface) throw new Error("a chart has no surface");
      boxes.forEach((a, i) => {
        expect(a.left).toBeGreaterThanOrEqual(surface.left);
        expect(a.right).toBeLessThanOrEqual(surface.right);
        expect(a.top).toBeGreaterThanOrEqual(surface.top);
        for (const b of boxes.slice(i + 1)) {
          const apart = a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
          expect(apart, `labels overlap: ${JSON.stringify([a, b])}`).toBe(true);
        }
        labels++;
      });
    }
    expect(labels).toBeGreaterThan(8);
  });

  test(`history markers sit on their day, grey spans the compared window and blue starts at the latest rule at ${width} width`, async ({
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
        const bands = [...card.querySelectorAll("[data-band]")].map((b) => ({
          kind: b.getAttribute("data-band"),
          left: b.getBoundingClientRect().left,
          right: b.getBoundingClientRect().right,
        }));
        return { id: card.id, points, markers, strokes, bands };
      }),
    );
    let markersChecked = 0;
    let windowsChecked = 0;
    let bandsChecked = 0;
    for (const mistake of fixture.mistakes) {
      const chart = charts.find((c) => c.id === mistake.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
      if (!chart) throw new Error(`no chart for ${mistake.name}`);
      expect(chart.markers.map((m) => m.day)).toEqual([...new Set(mistake.changes.map((c) => c.day))]);
      for (const marker of chart.markers) {
        const point = chart.points.find((p) => p.day === marker.day);
        if (!point) continue; // no data on that day: a gap, not a point
        expect(Math.abs(point.x - marker.x), `${mistake.name} ${marker.day}`).toBeLessThanOrEqual(1);
        markersChecked++;
      }
      const xs = (series: string) => chart.points.filter((p) => p.series === series).map((p) => p.x);
      const [faint, grey, blue] = [xs("earlier"), xs("before"), xs("after")];
      const dayX = (day: string | undefined) => chart.points.find((p) => p.day === day)?.x;
      // Grey covers exactly the compared window: it starts at the window's first day, where the faint earlier
      // history ends.
      const from = mistake.rule ? mistake.before?.from : mistake.current?.from;
      const fromX = dayX(from);
      const band = (kind: string) => chart.bands.find((b) => b.kind === kind);
      if (fromX !== undefined && grey.length > 0) {
        expect(Math.abs(Math.min(...grey) - fromX), `${mistake.name} grey start`).toBeLessThanOrEqual(1);
        expect(Math.abs((band("before")?.left ?? Number.NaN) - fromX), `${mistake.name} grey band`).toBeLessThanOrEqual(
          1,
        );
        expect(Math.abs(Math.max(...faint) - fromX), `${mistake.name} faint end`).toBeLessThanOrEqual(1);
        windowsChecked++;
      }
      if (mistake.rule === null) {
        expect(blue).toEqual([]);
        continue;
      }
      expect(chart.strokes).toContain("var(--with)");
      const latest = chart.markers.find((m) => m.day === mistake.rule?.day);
      if (!latest) {
        // The rule is older than the window: the whole line is blue.
        expect(grey).toEqual([]);
        continue;
      }
      // Grey and blue share the change day's point, so the colour switches exactly there.
      expect(Math.abs(Math.max(...grey) - latest.x), mistake.name).toBeLessThanOrEqual(1);
      expect(Math.abs(Math.min(...blue) - latest.x), mistake.name).toBeLessThanOrEqual(1);
      // The bands meet where the colour switches, and blue runs to the last day.
      const lastX = chart.points.find((p) => p.day === mistake.series.at(-1)?.day)?.x;
      if (band("before")) expect(Math.abs((band("before")?.right ?? 0) - latest.x)).toBeLessThanOrEqual(1);
      expect(Math.abs((band("after")?.left ?? Number.NaN) - latest.x), `${mistake.name} blue band`).toBeLessThanOrEqual(
        1,
      );
      if (lastX !== undefined) expect(Math.abs((band("after")?.right ?? 0) - lastX)).toBeLessThanOrEqual(1);
      bandsChecked++;
    }
    expect(bandsChecked).toBeGreaterThan(4);
    expect(windowsChecked).toBeGreaterThan(3);
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

test("on a wide screen the detail panel shows the picked mistake: first rule on load, then clicks, arrows and reloads", async ({
  page,
}) => {
  await page.setViewportSize(widths.desktop);
  const opened = await openBuilt(page);
  const panel = page.locator("[data-detail]");
  const row = (name: string) => page.locator("[data-row]", { hasText: name });
  await expect(panel).toHaveAttribute("data-detail", "branch-pushed-without-a-pull-request");
  await expect(row("Branch pushed without a pull request")).toHaveAttribute("aria-selected", "true");
  await row("Ports taken without checking").locator("span").first().click();
  await expect(panel).toHaveAttribute("data-detail", "ports-taken-without-checking");
  await expect(page.locator("[data-row][aria-selected=true]")).toHaveCount(1);
  await page.keyboard.press("ArrowDown");
  await expect(panel).toHaveAttribute("data-detail", "config-read-from-memory");
  await expect(row("Config read from memory")).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(panel).toHaveAttribute("data-detail", "ports-taken-without-checking");
  await page.reload();
  await expect(panel).toHaveAttribute("data-detail", "ports-taken-without-checking");
  await page.goto(`${opened.url}#/?m=old-branches-left-open`);
  await expect(panel).toHaveAttribute("data-detail", "old-branches-left-open");
  await panel.getByRole("link", { name: "All tracked mistakes" }).click();
  await expect(page.locator("header h1")).toHaveText("Tracked mistakes");
  await expect(page.locator("#old-branches-left-open")).toBeInViewport();
});

test("every block in the overview's left column shares one left and right edge", async ({ page }) => {
  await page.setViewportSize(widths.desktop);
  await openBuilt(page);
  const edges = await page.$$eval("[data-block]", (blocks) =>
    blocks.map((b) => [b.getBoundingClientRect().left, b.getBoundingClientRect().right]),
  );
  expect(edges.length).toBeGreaterThan(3);
  for (const [left, right] of edges) {
    expect(Math.abs(left - edges[0][0])).toBeLessThanOrEqual(0.5);
    expect(Math.abs(right - edges[0][1])).toBeLessThanOrEqual(0.5);
  }
});

test("the panel's chart puts each rule-change marker on its day's point", async ({ page }) => {
  await page.setViewportSize(widths.desktop);
  const opened = await openBuilt(page);
  await page.goto(`${opened.url}#/?m=replies-with-no-summary-line`);
  const found = await page.$$eval("[data-detail] [data-marker-day]", (markers) =>
    markers.map((m) => {
      const day = m.getAttribute("data-marker-day");
      const point = document.querySelector(`[data-detail] circle[data-day="${day}"]`);
      const x = (el: Element | null) =>
        el ? el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2 : null;
      return { day, marker: x(m.querySelector("line")), point: x(point) };
    }),
  );
  expect(found.map((f) => f.day)).toEqual(["2026-10-08", "2026-10-20"]);
  for (const { marker, point } of found) expect(Math.abs((marker ?? 0) - (point ?? Number.NaN))).toBeLessThanOrEqual(1);
});

test("on a phone a tapped row opens the detail in a sheet that closes back to the row", async ({ browser }) => {
  const context = await browser.newContext({ viewport: widths.phone, hasTouch: true });
  const page = await context.newPage();
  await openBuilt(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const row = page.locator("[data-row]", { hasText: "Ports taken without checking" });
  await row.locator("span").first().tap();
  const sheet = page.getByRole("dialog");
  await expect(sheet.locator("[data-detail]")).toHaveAttribute("data-detail", "ports-taken-without-checking");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(row).toBeFocused();
  await row.locator("span").first().tap();
  await sheet.getByRole("button", { name: "Close" }).tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await context.close();
});

test("hovering a marker on a computer says what changed then; the line under the chart stays the rule", async ({
  page,
}) => {
  await page.setViewportSize(widths.desktop);
  const opened = await openBuilt(page);
  await page.goto(`${opened.url}#/mistakes`);
  const card = page.locator("#replies-with-no-summary-line");
  await card.locator('[data-marker-day="2026-10-08"]').hover();
  await expect(card.locator("[data-marker-tip]")).toHaveText("Rule changed 8 Oct: Replies open with the answer");
  await expect(card.locator("[data-rule-line]")).toHaveText(
    "Rule since 20 Oct: Replies end with one line saying what is left",
  );
  const trial = page.locator("#config-read-from-memory");
  await trial.locator('[data-marker-kind="trial"]').hover();
  await expect(trial.locator("[data-marker-tip]")).toHaveText("Trial started 9 Nov");
  await expect(trial.locator("[data-rule-line]")).toHaveCount(0);
});

test("tapping a rule-change marker on a phone says what changed then", async ({ browser }) => {
  const context = await browser.newContext({ viewport: widths.phone, hasTouch: true });
  const page = await context.newPage();
  const opened = await openBuilt(page);
  await page.goto(`${opened.url}#/mistakes`);
  const card = page.locator("#replies-with-no-summary-line");
  await card.locator('[data-marker-day="2026-10-08"]').tap();
  await expect(card.locator("[data-marker-tip]")).toHaveText("Rule changed 8 Oct: Replies open with the answer");
  await context.close();
});

test("a rule change and a trial start on one day share a marker that names both", async ({ page }) => {
  await page.setViewportSize(widths.desktop);
  const opened = await openBuilt(page);
  await page.goto(`${opened.url}#/mistakes`);
  const card = page.locator("#long-logs-pasted-into-a-reply");
  await expect(card.locator("[data-marker-day]")).toHaveCount(1);
  await card.locator('[data-marker-day="2026-10-28"]').hover();
  await expect(card.locator("[data-marker-tip] p")).toHaveText([
    "Trial started 28 Oct",
    "Rule changed 28 Oct: Quote the failing lines, link the rest",
  ]);
});

test("the data's date shows once: in the sidebar on a computer, in the header on a phone", async ({ page }) => {
  for (const viewport of [widths.desktop, widths.phone]) {
    await page.setViewportSize(viewport);
    await openBuilt(page);
    await expect(page.getByText("Data up to 12 Nov", { exact: true }).filter({ visible: true })).toHaveCount(1);
  }
});

test("the panel reads the change against before the rule with its range, and draws its strip", async ({ page }) => {
  await page.setViewportSize(widths.desktop);
  await openBuilt(page);
  await expect(page.locator("[data-detail] [data-change-line]")).toHaveText(
    "100% fewer than before the rule · likely 88% to 100% fewer",
  );
  await expect(page.locator('[data-detail] [data-track="change"]')).toHaveCount(1);
});

for (const [width, viewport] of Object.entries(widths)) {
  test(`no number on a rate chart overlaps a dot, the arrow or another number at ${width} width`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const opened = await openBuilt(page);
    let labels = 0;
    for (const path of ["", "trials", "replays"]) {
      await page.goto(`${opened.url}#/${path}`);
      const tracks = await page.$$eval('[data-track="rate"]', (all) =>
        all.map((track) => {
          const box = (el: Element) => {
            const r = el.getBoundingClientRect();
            return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
          };
          return {
            track: box(track),
            labels: [...track.querySelectorAll("[data-label]")].map(box),
            dots: [...track.querySelectorAll("[data-rate]")].map(box),
            lines: [...track.querySelectorAll("[data-line] line, [data-line] polygon")].map(box),
          };
        }),
      );
      type Box = { left: number; right: number; top: number; bottom: number };
      const apart = (a: Box, b: Box) =>
        a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5;
      for (const t of tracks) {
        t.labels.forEach((label, i) => {
          expect(label.left).toBeGreaterThanOrEqual(t.track.left - 0.5);
          expect(label.right).toBeLessThanOrEqual(t.track.right + 0.5);
          for (const other of [...t.dots, ...t.lines, ...t.labels.slice(i + 1)]) {
            expect(apart(label, other), `#/${path} ${JSON.stringify([label, other])}`).toBe(true);
          }
          labels++;
        });
      }
    }
    expect(labels).toBeGreaterThan(10);
  });
}

test("no mistake name is cut short on a wide screen", async ({ page }) => {
  await page.setViewportSize(widths.desktop);
  await openBuilt(page);
  const cut = await page.$$eval("[data-name]", (names) =>
    names.filter((n) => n.scrollWidth > n.clientWidth).map((n) => n.textContent),
  );
  expect(cut).toEqual([]);
});

test("scorecard rows on a wide screen are one even line each, with the name in normal weight", async ({ page }) => {
  await page.setViewportSize(widths.desktop);
  await openBuilt(page);
  const rows = await page.$$eval('[data-table="rules"] [data-row]', (all) =>
    all.map((row) => {
      const name = row.querySelector("[data-name]") as HTMLElement;
      return {
        height: row.getBoundingClientRect().height,
        weight: Number(getComputedStyle(name).fontWeight),
        lines: Math.round(name.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(name).lineHeight)),
        title: name.title,
        text: name.textContent,
      };
    }),
  );
  expect(rows.length).toBeGreaterThan(3);
  for (const row of rows) {
    expect(Math.abs(row.height - rows[0].height)).toBeLessThanOrEqual(0.5);
    expect(row.weight).toBeLessThan(500);
    expect(row.lines).toBe(1);
    expect(row.title).toBe(row.text);
  }
});
