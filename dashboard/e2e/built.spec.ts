import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { emptyReport, fixture } from "../src/data/fixture.ts";
import { builtPage, openBuilt, widths } from "./built.ts";

// Words the page never uses, since they are the method's and not his ("No big effect" is his); "CI" is matched in capitals only.
const BANNED =
  /\b(measures?|settled|holdout|off course|stamped|grouped|sessions?|looks?|drops?|p-value|confidence interval|bootstrap|kind)\b/i;

// Rows of the fixture, one for each state the page must show.
const WORKS = "trial-tests-skipped-before-a-commit";
const RUNNING = "trial-config-read-from-memory";
const SCHEDULED = "trial-screenshots-sent-without-a-link";
const NO_EFFECT = "trial-commit-messages-with-no-reason";
const WORSE = "trial-ports-taken-without-checking";
const REPLAYED = "trial-replies-with-no-summary-line";

const row = (page: Page, id: string) => page.locator(`[data-row="${id}"]`);
const card = (page: Page, id: string) => page.locator(`[data-detail="${id}"]`);
const sections = (page: Page) =>
  page.locator("[data-detail] [data-section]").evaluateAll((all) => all.map((s) => s.getAttribute("data-section")));

async function openWide(page: Page, hash = "") {
  await page.setViewportSize(widths.desktop);
  const opened = await openBuilt(page);
  if (hash) await page.goto(`${opened.url}${hash}`);
  return opened;
}

for (const [name, report] of Object.entries({ fixture, empty: emptyReport })) {
  for (const [width, viewport] of Object.entries(widths)) {
    test(`the page renders cleanly with the ${name} report at ${width} width`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const opened = await openBuilt(page, report);
      await expect(page.locator("h1")).toHaveText("Did this week's changes make agents better?");
      // biome-ignore lint/performance/useDomNodeTextContent: only words shown on screen count, not hidden ones.
      const text = await page.locator("body").innerText();
      expect(text).not.toMatch(BANNED);
      expect(text).not.toMatch(/\bCI\b/);
      if (name === "empty") expect(text).toContain("No rule changes this week.");
      const found = await page.evaluate(() => {
        const small: string[] = [];
        for (const el of document.querySelectorAll("body *")) {
          const ownText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
          const size = Number.parseFloat(getComputedStyle(el).fontSize);
          if (ownText && el.getClientRects().length > 0 && size < 12) small.push(`${el.textContent} (${size}px)`);
        }
        return { small, overflow: document.documentElement.scrollWidth - window.innerWidth };
      });
      expect(found.small, "text under 12px").toEqual([]);
      expect(found.overflow, "horizontal scroll").toBeLessThanOrEqual(0);
      expect(opened.errors).toEqual([]);
      expect(opened.otherRequests()).toEqual([]);
    });
  }
}

test("the page opens with one row per rule change: those awaiting a verdict, then this week's verdicts", async ({
  page,
}) => {
  await openWide(page);
  const ids = await page.locator("[data-row]").evaluateAll((all) => all.map((r) => r.getAttribute("data-row")));
  expect(ids).toEqual([RUNNING, SCHEDULED, REPLAYED, WORKS, NO_EFFECT, WORSE]);
  const cells = row(page, WORKS);
  await expect(cells.locator("[data-name]")).toHaveText("Run the tests before each commit");
  await expect(cells).toContainText("Tests skipped before a commit");
  await expect(cells.locator("[data-before]")).toHaveText("25%");
  await expect(cells.locator("[data-since]")).toHaveText("10%");
  await expect(cells.locator("[data-verdict]")).toHaveText("Works");
  // With nothing wording the change, the row is named for its mistake.
  await expect(row(page, NO_EFFECT).locator("[data-name]")).toHaveText("Commit messages with no reason");
});

test("a change awaiting its verdict shows its rate so far, or the day it starts, and the day its verdict is due", async ({
  page,
}) => {
  await openWide(page);
  await expect(row(page, RUNNING).locator("[data-since]")).toHaveText("9%");
  await expect(row(page, RUNNING).locator("[data-verdict]")).toHaveText("Day 3 on 13 Nov");
  await expect(row(page, SCHEDULED).locator("[data-since]")).toHaveText("from 13 Nov");
  await expect(row(page, SCHEDULED).locator("[data-verdict]")).toHaveText("Day 3 on 15 Nov");
});

test("below the table, one line of needless stops per 100 for each rule version with enough stops", async ({
  page,
}) => {
  await openWide(page);
  const overall = page.getByRole("region", { name: "Is it improving overall?" });
  await expect(overall.getByRole("img")).toHaveAccessibleName(
    "Needless stops per 100 stops, by rule version: v0: 30, v1: 19, v2: 16, v4: 21",
  );
  await expect(overall.getByText("Rule version")).toBeVisible();
  await expect(overall.getByText("Needless stops per 100 stops")).toBeVisible();
  await openBuilt(page, emptyReport);
  await expect(page.getByRole("region", { name: "Is it improving overall?" })).toHaveCount(0);
});

test("each row's status is its verdict, one of four, each with its own icon", async ({ page }) => {
  await openWide(page);
  const expected = {
    [WORKS]: ["works", "Works"],
    [REPLAYED]: ["works", "Works"],
    [WORSE]: ["worse", "Worse"],
    [NO_EFFECT]: ["no-effect", "No big effect"],
    [RUNNING]: ["due", ""],
    [SCHEDULED]: ["due", ""],
  };
  for (const [id, [status, words]] of Object.entries(expected)) {
    await expect(row(page, id), id).toHaveAttribute("data-status", status);
    await expect(row(page, id).locator(`[data-status-icon="${status}"]`), id).toBeVisible();
    if (status !== "due") await expect(row(page, id).locator("[data-verdict]"), id).toHaveText(words);
  }
});

test("pointing at a row shows its card, a click keeps it, and leaving the table returns to the kept one", async ({
  page,
}) => {
  await openWide(page);
  await row(page, REPLAYED).hover();
  await expect(card(page, REPLAYED)).toBeVisible();
  await row(page, WORKS).click();
  await expect(page).toHaveURL(new RegExp(`#${WORKS}$`));
  await expect(row(page, WORKS)).toHaveAttribute("aria-current", "true");
  await row(page, REPLAYED).hover();
  await expect(card(page, REPLAYED)).toBeVisible();
  await page.mouse.move(5, 5);
  await expect(card(page, WORKS)).toBeVisible();
  await row(page, REPLAYED).hover();
  // The pointer can cross to the card without losing it.
  await card(page, REPLAYED).hover();
  await page.waitForTimeout(400);
  await expect(card(page, REPLAYED)).toBeVisible();
  await page.mouse.move(5, 5);
  await expect(card(page, WORKS)).toBeVisible();
  await row(page, WORKS).click();
  await page.mouse.move(5, 5);
  await expect(card(page, "page")).toBeVisible();
});

test("moving focus to a row with the keyboard shows its card", async ({ page }) => {
  await openWide(page);
  let focused: string | null = null;
  for (let i = 0; i < 12 && !focused; i++) {
    await page.keyboard.press("Tab");
    focused = await page.evaluate(() => document.activeElement?.getAttribute("data-row") ?? null);
  }
  expect(focused).toBe(RUNNING);
  await expect(card(page, RUNNING)).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(card(page, "page")).toBeVisible();
});

test("an agent's link to a rule opens its card, in today's form and in every earlier one", async ({ page }) => {
  const opened = await openWide(page);
  const links = {
    [`#${REPLAYED}`]: REPLAYED,
    [`#/?m=${WORKS}`]: WORKS,
    "#/mistakes/replies-with-no-summary-line": REPLAYED,
    "#/?m=mistake-replies-with-no-summary-line": REPLAYED,
  };
  for (const [hash, id] of Object.entries(links)) {
    await page.goto(`${opened.url}${hash}`);
    await expect(card(page, id), hash).toBeVisible();
  }
  await page.goto(`${opened.url}#/replays`);
  await expect(card(page, "page")).toBeVisible();
});

test("on a phone a linked rule's card is the whole screen, with a way back to the table", async ({ page }) => {
  await page.setViewportSize(widths.phone);
  const opened = await openBuilt(page);
  await expect(page.locator("[data-detail]")).toHaveCount(0);
  await page.goto(`${opened.url}#${WORKS}`);
  await expect(card(page, WORKS)).toBeVisible();
  await expect(page.locator("[data-table]")).toHaveCount(0);
  await expect(card(page, WORKS).locator("[data-estimate]")).toHaveText("−60%");
  // The swap removes what had focus, so it moves to the card, and back to the row on return.
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("ASIDE");
  await page.getByRole("link", { name: "All rule changes" }).click();
  await expect(page.locator("[data-table]").first()).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.getAttribute("data-row"))).toBe(WORKS);
  await row(page, REPLAYED).click();
  await expect(card(page, REPLAYED)).toBeVisible();
});

test("every card has its sections in one order, and one with no verdict has no change", async ({ page }) => {
  const opened = await openWide(page);
  const expected = {
    [WORKS]: ["verdict", "before-after", "change", "basis", "hand"],
    [NO_EFFECT]: ["verdict", "before-after", "change", "basis", "hand"],
    [RUNNING]: ["verdict", "before-after", "basis", "hand"],
  };
  for (const [id, order] of Object.entries(expected)) {
    await page.goto(`${opened.url}#${id}`);
    await expect(card(page, id)).toBeVisible();
    expect(await sections(page), id).toEqual(order);
  }
  await expect(card(page, RUNNING).locator("[data-verdict]")).toHaveText("Verdict due");
  await expect(card(page, RUNNING).getByText("2 of 3")).toBeVisible();
  // Beside the table the row already gives the number, so the card does not repeat it.
  await page.goto(`${opened.url}#${WORKS}`);
  const works = card(page, WORKS);
  await expect(works.locator("[data-estimate]")).toBeHidden();
  await expect(works.locator('[data-end="low"]')).toHaveText("−78%");
  await expect(works.locator('[data-end="high"]')).toHaveText("−33%");
  // Before and since are dots on one axis of the share of chances broken; fewer mistakes since sits further left.
  const at = (side: string) =>
    works.locator(`[data-side="${side}"] [data-rate]`).evaluate((dot) => dot.getBoundingClientRect().left);
  expect(await at("after")).toBeLessThan(await at("before"));
  await expect(works.locator('[data-section="before-after"] [role="img"]')).toHaveAccessibleName(
    "Before: 25% of chances broken, Since: 10% of chances broken",
  );
  await expect(works.locator("[data-axis]")).toHaveText("0%10%20%30%40%50%");
  // A rare mistake's verdict came from its replay.
  await page.goto(`${opened.url}#${REPLAYED}`);
  await expect(card(page, REPLAYED).locator("dd", { hasText: /^Replay$/ })).toBeVisible();
});

test("copy for an agent copies the result and the sessions behind its latest misses, worded as a request", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async (text: string) => Object.assign(window, { copied: text }) },
    });
  });
  const opened = await openWide(page);
  await page.goto(`${opened.url}#${REPLAYED}`);
  const hand = card(page, REPLAYED).locator('[data-section="hand"]');
  await expect(hand.locator("[data-misses] dd")).toHaveCount(1);
  await hand.getByRole("button", { name: "Copy for an agent" }).click();
  await expect(hand.getByRole("status")).toHaveText("Copied");
  const copied = String(await page.evaluate(() => (window as unknown as { copied: string }).copied));
  const change = fixture.trials.find((t) => t.name === "Replies with no summary line");
  expect(copied).toMatch(/^Find out why agents still make this mistake/);
  expect(copied).toContain("Replies with no summary line");
  expect(copied).toContain("Works");
  for (const miss of change?.misses ?? []) expect(copied).toContain(miss.session);
  expect(change?.misses.length).toBeGreaterThan(0);
});

test("with no rule picked the card says how the numbers are made and what each mark means", async ({ page }) => {
  await openWide(page);
  const about = card(page, "page");
  await expect(about.getByRole("heading")).toHaveText("How these numbers are made");
  for (const mark of ["A band", "A verdict", "A day of real use", "A change that does nothing"]) {
    await expect(about.getByText(mark, { exact: true })).toBeVisible();
  }
});

test("a change larger than the scale stops at the edge with a mark", async ({ page }) => {
  await openWide(page, `#${WORSE}`);
  const band = card(page, WORSE).locator('[data-track="change"]');
  await expect(band.locator("[data-clipped]")).toBeVisible();
  await expect(card(page, WORSE).locator('[data-end="high"]')).toHaveText("+310% ›");
  const { edge, dot } = await band.evaluate((track) => {
    const mark = track.querySelector("[data-value]")?.getBoundingClientRect();
    return { edge: track.getBoundingClientRect().right, dot: mark ? mark.left + mark.width / 2 : Number.NaN };
  });
  expect(Math.abs(dot - edge)).toBeLessThanOrEqual(1);
  await page.goto(page.url().replace(WORSE, WORKS));
  await expect(card(page, WORKS).locator("[data-clipped]")).toHaveCount(0);
});

test("the placeholder appears once, so injection replaces only the report", async () => {
  const html = await readFile(builtPage, "utf8");
  expect(html.split("__REPORT__")).toHaveLength(2);
});

test("an injected report is shown, even with </script> in a name", async ({ page }) => {
  await page.setViewportSize(widths.desktop);
  const opened = await openBuilt(page, {
    ...fixture,
    day: "2031-04-05",
    trials: [{ ...fixture.trials[0], name: "A </script> in a name" }],
  });
  await expect(page.getByText("data to 5 Apr")).toBeVisible();
  await expect(page.getByText("A </script> in a name")).toBeVisible();
  expect(opened.errors).toEqual([]);
});
