import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { emptyReport, fixture } from "../src/data/fixture.ts";
import { builtPage, openBuilt, wideWidths, widths } from "./built.ts";

// Words the page never uses (the design brief's rule 3); "CI" is matched in capitals only.
const BANNED =
  /\b(measures?|settled|holdout|off course|stamped|grouped|sessions?|looks?|effects?|drops?|p-value|confidence interval|bootstrap|kind)\b/i;

const reports = { fixture, empty: emptyReport };
const allWidths = { ...widths, ...wideWidths };
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

type Box = { left: number; right: number; top: number; bottom: number };
const apart = (a: Box, b: Box) =>
  a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5;

/**
 * Every 0–100% track, change strip, scale and caption row on the page outside the detail, with its marks, measured
 * where they are drawn: they all sit in the one chart column, so they share a left edge and a width.
 */
async function measureTracks(page: Page) {
  return page.evaluate(() => {
    const box = (el: Element) => el.getBoundingClientRect();
    const centre = (el: Element) => box(el).left + box(el).width / 2;
    return [...document.querySelectorAll('[data-track="rate"], [data-track="change"], [data-scale], [data-axis]')]
      .filter((track) => box(track).width > 0 && !track.closest("[data-detail]"))
      .map((track) => {
        const rate = track.getAttribute("data-track") !== "change";
        return {
          rate,
          left: box(track).left,
          width: box(track).width,
          marks: [...track.querySelectorAll(rate ? "[data-rate]" : "[data-value]")].map((m) => ({
            value: Number(m.getAttribute(rate ? "data-rate" : "data-value")),
            x: centre(m),
          })),
        };
      });
  });
}

/** Opens a row's detail through the address, as a link to it would. */
async function pick(page: Page, url: string, id: string) {
  await page.goto(`${url}#/?m=${id}`);
  await expect(page.locator(`[data-detail="${id}"]`)).toBeVisible();
}

for (const [name, report] of Object.entries(reports)) {
  for (const [width, viewport] of Object.entries(widths)) {
    test(`the page renders cleanly with the ${name} report at ${width} width`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const opened = await openBuilt(page, report);
      await expect(page.locator("header h1")).toHaveText("Rule experiments");
      // biome-ignore lint/performance/useDomNodeTextContent: only words shown on screen count, not hidden ones.
      const text = await page.locator("body").innerText();
      expect(text).not.toMatch(BANNED);
      expect(text).not.toMatch(/\bCI\b/);
      if (name === "empty") {
        for (const empty of ["No trials yet", "No proven rules yet", "No replays yet"]) expect(text).toContain(empty);
      }
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
      expect(found.small, "text under 12px").toEqual([]);
      expect(found.mono, "monospace").toEqual([]);
      expect(found.overflow, "horizontal scroll").toBeLessThanOrEqual(0);
      expect(opened.errors).toEqual([]);
      expect(opened.otherRequests()).toEqual([]);
    });
  }
}

for (const [width, viewport] of Object.entries(allWidths)) {
  test(`every section's charts share one column and every mark sits at its value at ${width} width`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openBuilt(page);
    const tracks = await measureTracks(page);
    expect(tracks.length).toBeGreaterThan(20);
    let marks = 0;
    for (const track of tracks) {
      expect(Math.abs(track.left - tracks[0].left), "left edge").toBeLessThanOrEqual(0.5);
      expect(Math.abs(track.width - tracks[0].width), "width").toBeLessThanOrEqual(0.5);
      for (const mark of track.marks) {
        const at = track.rate ? mark.value : (Math.min(1, Math.max(-1, mark.value)) + 1) / 2;
        expect(Math.abs(mark.x - (track.left + at * track.width)), `${mark.value}`).toBeLessThanOrEqual(1);
        marks++;
      }
    }
    expect(marks).toBeGreaterThan(20);
  });
}

for (const [width, viewport] of Object.entries(widths)) {
  test(`no number on a rate chart overlaps a dot, the arrow or another number at ${width} width`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openBuilt(page);
    const tracks = await page.$$eval('[data-track="rate"]', (all) =>
      all
        .filter((track) => track.getBoundingClientRect().width > 0)
        .map((track) => {
          const box = (el: Element) => {
            const r = el.getBoundingClientRect();
            return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
          };
          // Numbers sit in the gutters around the track, so they must stay inside the track's padded column.
          return {
            column: box(track.parentElement as Element),
            labels: [...track.querySelectorAll("[data-label]")].map(box),
            dots: [...track.querySelectorAll("[data-rate]")].map(box),
            lines: [...track.querySelectorAll("[data-line] line, [data-line] polygon")].map(box),
          };
        }),
    );
    let labels = 0;
    for (const t of tracks) {
      t.labels.forEach((label, i) => {
        expect(label.left).toBeGreaterThanOrEqual(t.column.left - 0.5);
        expect(label.right).toBeLessThanOrEqual(t.column.right + 0.5);
        for (const other of [...t.dots, ...t.lines, ...t.labels.slice(i + 1)]) {
          expect(apart(label, other), JSON.stringify([label, other])).toBe(true);
        }
        labels++;
      });
    }
    expect(labels).toBeGreaterThan(20);
  });

  test(`each mistake's chart in the detail puts markers on their days and shades its windows at ${width} width`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const opened = await openBuilt(page);
    let markersChecked = 0;
    let windowsChecked = 0;
    let labels = 0;
    for (const mistake of fixture.mistakes) {
      const id = `mistake-${slug(mistake.name)}`;
      await pick(page, opened.url, id);
      const chart = await page.evaluate((id) => {
        const detail = document.querySelector(`[data-detail="${id}"]`) as Element;
        const x = (el: Element) => el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2;
        const box = (el: Element) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        };
        return {
          surface: box(detail.querySelector(".recharts-surface") ?? detail),
          labels: [...detail.querySelectorAll("[data-marker-label]")].map(box),
          points: [...detail.querySelectorAll("circle[data-day]")].map((p) => ({
            day: p.getAttribute("data-day"),
            series: p.getAttribute("data-series"),
            x: x(p),
          })),
          markers: [...detail.querySelectorAll("[data-marker-day]")].map((m) => ({
            day: m.getAttribute("data-marker-day"),
            x: x(m.querySelector("line") as Element),
          })),
          bands: [...detail.querySelectorAll("[data-band]")].map((b) => ({
            kind: b.getAttribute("data-band"),
            left: b.getBoundingClientRect().left,
            right: b.getBoundingClientRect().right,
          })),
        };
      }, id);
      expect(chart.markers.map((m) => m.day)).toEqual([...new Set(mistake.changes.map((c) => c.day))]);
      chart.labels.forEach((a, i) => {
        expect(a.left).toBeGreaterThanOrEqual(chart.surface.left);
        expect(a.right).toBeLessThanOrEqual(chart.surface.right);
        for (const b of chart.labels.slice(i + 1)) expect(apart(a, b), "marker labels overlap").toBe(true);
        labels++;
      });
      for (const marker of chart.markers) {
        const point = chart.points.find((p) => p.day === marker.day);
        if (!point) continue; // no data on that day: a gap, not a point
        expect(Math.abs(point.x - marker.x), `${mistake.name} ${marker.day}`).toBeLessThanOrEqual(1);
        markersChecked++;
      }
      const xs = (series: string) => chart.points.filter((p) => p.series === series).map((p) => p.x);
      const [faint, grey, blue] = [xs("earlier"), xs("before"), xs("after")];
      const dayX = (day: string | undefined) => chart.points.find((p) => p.day === day)?.x;
      const band = (kind: string) => chart.bands.find((b) => b.kind === kind);
      // Grey covers exactly the compared window: from its first day, where the faint earlier history ends.
      const fromX = dayX(mistake.rule ? mistake.before?.from : mistake.current?.from);
      if (fromX !== undefined && grey.length > 0) {
        expect(Math.abs(Math.min(...grey) - fromX), `${mistake.name} grey start`).toBeLessThanOrEqual(1);
        expect(Math.abs((band("before")?.left ?? Number.NaN) - fromX), `${mistake.name} band`).toBeLessThanOrEqual(1);
        expect(Math.abs(Math.max(...faint) - fromX), `${mistake.name} faint end`).toBeLessThanOrEqual(1);
        windowsChecked++;
      }
      if (mistake.rule === null) {
        expect(blue).toEqual([]);
        continue;
      }
      const latest = chart.markers.find((m) => m.day === mistake.rule?.day);
      if (!latest) {
        expect(grey).toEqual([]); // the rule is older than the window: the whole line is blue
        continue;
      }
      // Grey and blue share the change day's point and the bands meet there, so the colour switches exactly there.
      expect(Math.abs(Math.max(...grey) - latest.x), mistake.name).toBeLessThanOrEqual(1);
      expect(Math.abs(Math.min(...blue) - latest.x), mistake.name).toBeLessThanOrEqual(1);
      expect(Math.abs((band("after")?.left ?? Number.NaN) - latest.x), `${mistake.name} blue band`).toBeLessThanOrEqual(
        1,
      );
    }
    expect(markersChecked).toBeGreaterThan(5);
    expect(windowsChecked).toBeGreaterThan(3);
    expect(labels).toBeGreaterThan(8);
  });
}

test("on a wide screen the panel shows the picked row of every kind: first attention item, clicks, arrows, reloads", async ({
  page,
}) => {
  await page.setViewportSize(widths.desktop);
  const opened = await openBuilt(page);
  const panel = page.locator("[data-detail]");
  const row = (id: string) => page.locator(`[data-row="${id}"]`);
  // On load: the row the first attention item is about.
  await expect(panel).toHaveAttribute("data-detail", "mistake-tests-skipped-before-a-commit");
  await page.locator('[data-attention="permanent-drafts-saved-in-the-wrong-folder"]').click();
  await expect(panel).toHaveAttribute("data-kind", "permanent");
  for (const [id, kind] of [
    ["trial-config-read-from-memory", "trial"],
    ["permanent-replies-with-no-summary-line", "permanent"],
    ["mistake-ports-taken-without-checking", "mistake"],
    ["replay-ports-taken-without-checking", "replay"],
    ["size-skills", "size"],
  ]) {
    await row(id).locator("[data-name]").click();
    await expect(panel).toHaveAttribute("data-detail", id);
    await expect(panel).toHaveAttribute("data-kind", kind);
    await expect(page.locator("[data-row][aria-selected=true]")).toHaveCount(1);
  }
  // Up and Down walk every row of every section in page order, across section edges.
  await row("trial-tests-skipped-before-a-commit").locator("[data-name]").click();
  await page.keyboard.press("ArrowDown");
  await expect(panel).toHaveAttribute("data-detail", "permanent-replies-with-no-summary-line");
  await expect(row("permanent-replies-with-no-summary-line")).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(panel).toHaveAttribute("data-detail", "trial-tests-skipped-before-a-commit");
  await page.reload();
  await expect(panel).toHaveAttribute("data-detail", "trial-tests-skipped-before-a-commit");
  // The old pages' addresses still open the page at their section, or with their mistake picked.
  await page.goto(`${opened.url}#/mistakes/old-branches-left-open`);
  await expect(panel).toHaveAttribute("data-detail", "mistake-old-branches-left-open");
  await page.goto(`${opened.url}#/replays`);
  await expect(page.locator("#section-replays")).toBeInViewport();
});

test("every block of the left column shares one left and right edge", async ({ page }) => {
  await page.setViewportSize(widths.desktop);
  await openBuilt(page);
  const edges = await page.$$eval("[data-block]", (blocks) =>
    blocks.map((b) => [b.getBoundingClientRect().left, b.getBoundingClientRect().right]),
  );
  expect(edges.length).toBeGreaterThan(5);
  for (const [left, right] of edges) {
    expect(Math.abs(left - edges[0][0])).toBeLessThanOrEqual(0.5);
    expect(Math.abs(right - edges[0][1])).toBeLessThanOrEqual(0.5);
  }
});

test("on a phone a tapped row opens its detail in a sheet that closes back to the row", async ({ browser }) => {
  const context = await browser.newContext({ viewport: widths.phone, hasTouch: true });
  const page = await context.newPage();
  await openBuilt(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const row = page.locator('[data-row="replay-ports-taken-without-checking"]');
  await row.locator("[data-name]").tap();
  const sheet = page.getByRole("dialog");
  await expect(sheet.locator("[data-detail]")).toHaveAttribute("data-detail", "replay-ports-taken-without-checking");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(row).toBeFocused();
  await row.locator("[data-name]").tap();
  await sheet.getByRole("button", { name: "Close" }).tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await context.close();
});

test("rows on a wide screen are one even line each with whole names in normal weight", async ({ page }) => {
  await page.setViewportSize(widths.desktop);
  await openBuilt(page);
  const rows = await page.$$eval("[data-row]", (all) =>
    all.map((row) => {
      const name = row.querySelector("[data-name]") as HTMLElement;
      return {
        height: row.getBoundingClientRect().height,
        weight: Number(getComputedStyle(name).fontWeight),
        cut: name.scrollWidth > name.clientWidth,
        text: name.textContent,
      };
    }),
  );
  expect(rows.length).toBeGreaterThan(20);
  for (const row of rows) {
    expect(Math.abs(row.height - rows[0].height), `${row.text} height`).toBeLessThanOrEqual(0.5);
    expect(row.weight).toBeLessThan(500);
    expect(row.cut, `${row.text} is cut short`).toBe(false);
  }
});

for (const [width, viewport] of Object.entries(wideWidths)) {
  test(`on a ${width}px screen the page stays in its centred frame, with charts and rows at their caps`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const opened = await openBuilt(page);
    const found = await page.evaluate(() => {
      const box = (el: Element | null) => el?.getBoundingClientRect() ?? new DOMRect();
      const frame = box(document.querySelector("[data-frame]"));
      const widths = (selector: string) => [...document.querySelectorAll(selector)].map((el) => box(el).width);
      return {
        frame: frame.width,
        offCentre: frame.left + frame.width / 2 - window.innerWidth / 2,
        charts: widths("[data-slot=chart]"),
        history: widths("[data-detail] .relative > [data-slot=chart]"),
        rows: widths("[data-row]"),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(found.frame).toBeLessThanOrEqual(1320.5);
    expect(Math.abs(found.offCentre)).toBeLessThanOrEqual(1);
    for (const w of found.charts) expect(w).toBeLessThanOrEqual(560);
    for (const w of found.history) expect(w).toBeLessThanOrEqual(520);
    for (const w of found.rows) expect(w).toBeLessThanOrEqual(840);
    expect(found.overflow).toBeLessThanOrEqual(0);
    expect(opened.errors).toEqual([]);
  });
}

test("the placeholder appears once, so injection replaces only the report", async () => {
  const html = await readFile(builtPage, "utf8");
  expect(html.split("__REPORT__")).toHaveLength(2);
});

test("an injected report is shown, even with </script> in a name", async ({ page }) => {
  await page.setViewportSize(widths.desktop);
  const opened = await openBuilt(page, {
    ...fixture,
    day: "2031-04-05",
    replays: [{ ...fixture.replays[0], name: "A </script> in a name" }],
  });
  await expect(page.getByText("Data up to 5 Apr")).toBeVisible();
  await expect(page.getByText("A </script> in a name")).toBeVisible();
  expect(opened.errors).toEqual([]);
});

test("the data's date shows once on the screen, in the top bar", async ({ page }) => {
  for (const viewport of [widths.desktop, widths.phone]) {
    await page.setViewportSize(viewport);
    await openBuilt(page);
    await expect(page.getByText("Data up to 12 Nov", { exact: true }).filter({ visible: true })).toHaveCount(1);
  }
});

test("every kind's detail has the one shape: kind, title, one headline, one line, captioned charts, no text twice", async ({
  page,
}) => {
  await page.setViewportSize(widths.desktop);
  const opened = await openBuilt(page);
  const ids = [
    "trial-screenshots-sent-without-a-link",
    "trial-config-read-from-memory",
    "trial-tests-skipped-before-a-commit",
    "permanent-replies-with-no-summary-line",
    "permanent-branch-pushed-without-a-pull-request",
    "permanent-drafts-saved-in-the-wrong-folder",
    "mistake-branch-pushed-without-a-pull-request",
    "mistake-questions-asked-that-the-notes-answer",
    "mistake-old-branches-left-open",
    "replay-replies-with-no-summary-line",
    "replay-ports-taken-without-checking",
    "size-rules",
    "size-skills",
  ];
  for (const id of ids) {
    await pick(page, opened.url, id);
    const found = await page.evaluate((id) => {
      const detail = document.querySelector(`[data-detail="${id}"]`) as Element;
      // Text outside the charts' own drawing, where a repeated tick or label is the chart's business.
      const texts = [...detail.querySelectorAll("*")]
        .filter((el) => !el.closest("svg") && [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE))
        .map((el) =>
          [...el.childNodes]
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent)
            .join("")
            .trim(),
        )
        .filter((t) => t.length > 3);
      return {
        kinds: detail.querySelectorAll("[data-kind-label]").length,
        headlines: detail.querySelectorAll("[data-headline]").length,
        lines: detail.querySelectorAll("[data-description]").length,
        captions: detail.querySelectorAll("[data-caption]").length,
        repeated: texts.filter((t, i) => texts.indexOf(t) !== i),
      };
    }, id);
    expect(found, id).toMatchObject({ kinds: 1, headlines: 1, lines: 1, repeated: [] });
    expect(found.captions, id).toBeGreaterThan(0);
  }
  await pick(page, opened.url, "mistake-branch-pushed-without-a-pull-request");
  await expect(page.locator("[data-detail] [data-headline]")).toHaveText("100% fewer than before the rule");
  await pick(page, opened.url, "replay-ports-taken-without-checking");
  await expect(page.locator("[data-detail] [data-headline]")).toHaveText("Can't be trusted");
});

test("hovering a marker on a computer says what changed then", async ({ page }) => {
  await page.setViewportSize(widths.desktop);
  const opened = await openBuilt(page);
  await pick(page, opened.url, "mistake-replies-with-no-summary-line");
  const detail = page.locator("[data-detail]");
  await detail.locator('[data-marker-day="2026-10-20"] [data-marker-label]').hover();
  await expect(detail.locator("[data-marker-tip]")).toHaveText(
    "Rule changed 20 Oct: Replies end with one line saying what is left",
  );
  await pick(page, opened.url, "mistake-config-read-from-memory");
  await detail.locator('[data-marker-kind="trial"] [data-marker-label]').hover();
  await expect(detail.locator("[data-marker-tip]")).toHaveText("Trial began 9 Nov");
  await pick(page, opened.url, "mistake-long-logs-pasted-into-a-reply");
  await expect(detail.locator("[data-marker-day]")).toHaveCount(1);
  await detail.locator('[data-marker-day="2026-10-28"] [data-marker-label]').hover();
  await expect(detail.locator("[data-marker-tip] p")).toHaveText([
    "Trial began 28 Oct",
    "Rule changed 28 Oct: Quote the failing lines, link the rest",
  ]);
});

test("tapping a rule-change marker on a phone says what changed then", async ({ browser }) => {
  const context = await browser.newContext({ viewport: widths.phone, hasTouch: true });
  const page = await context.newPage();
  const opened = await openBuilt(page);
  await pick(page, opened.url, "mistake-replies-with-no-summary-line");
  const detail = page.locator("[data-detail]");
  await detail.locator('[data-marker-day="2026-10-20"] [data-marker-label]').tap();
  await expect(detail.locator("[data-marker-tip]")).toHaveText(
    "Rule changed 20 Oct: Replies end with one line saying what is left",
  );
  await context.close();
});
