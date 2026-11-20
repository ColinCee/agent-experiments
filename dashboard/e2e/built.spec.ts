import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { emptyReport, fixture } from "../src/data/fixture.ts";
import { builtPage, openBuilt, widths } from "./built.ts";

// Words the page never uses, since they are the method's and not his; "CI" is matched in capitals only.
const BANNED =
  /\b(measures?|settled|holdout|off course|stamped|grouped|sessions?|looks?|effects?|drops?|p-value|confidence interval|bootstrap|kind)\b/i;

// Rows of the fixture, one for each state the page must show.
const WORKS = "trial-tests-skipped-before-a-commit";
const RUNNING = "trial-config-read-from-memory";
const SCHEDULED = "trial-screenshots-sent-without-a-link";
const CANT_TELL = "trial-commit-messages-with-no-reason";
const PAST_SCALE = "trial-ports-taken-without-checking";
const RULE = "permanent-long-logs-pasted-into-a-reply";
const SLIPPING = "permanent-drafts-saved-in-the-wrong-folder";
const WAITING = "permanent-branch-pushed-without-a-pull-request";

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
      await expect(page.locator("h1")).toHaveText("Rule experiments");
      // biome-ignore lint/performance/useDomNodeTextContent: only words shown on screen count, not hidden ones.
      const text = await page.locator("body").innerText();
      expect(text).not.toMatch(BANNED);
      expect(text).not.toMatch(/\bCI\b/);
      if (name === "empty") expect(text).toContain("No experiments or active rules yet.");
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

test("the page opens with one row per experiment and active rule, finished experiments in a third group", async ({
  page,
}) => {
  await openWide(page);
  await expect(page.locator("[data-group] [data-row]")).toHaveCount(fixture.trials.length + fixture.permanent.length);
  expect(await page.locator("[data-group]").evaluateAll((all) => all.map((g) => g.getAttribute("data-group")))).toEqual(
    ["running", "active", "finished"],
  );
  await expect(page.locator('[data-group="running"] [data-row]')).toHaveCount(2);
  await expect(row(page, SCHEDULED)).toBeVisible();
  await expect(page.locator('[data-group="finished"] [data-row]')).toHaveCount(3);
  const cells = row(page, WORKS);
  await expect(cells.locator("[data-name]")).toHaveText("Tests skipped before a commit");
  await expect(cells.locator('[data-track="change"]')).toBeVisible();
  await expect(cells.locator("[data-change]")).toHaveText("−60%");
  await expect(cells.getByRole("img", { name: "Works" })).toBeVisible();
});

test("each skill is a row below, most missed first, and its card shows its rate over time and by version", async ({
  page,
}) => {
  await openWide(page);
  const skills = page.getByRole("region", { name: "Skills" }).locator("[data-row]");
  await expect(skills).toHaveCount(fixture.skills.length);
  expect(await skills.locator("[data-name]").allTextContents()).toEqual([
    "Reviews done without the review skill",
    "Releases cut without the release skill",
    "Exports run without the export skill",
  ]);
  await expect(skills.nth(0).locator("[data-rate]")).toHaveText("60%");
  await expect(skills.nth(2).locator("[data-rate]")).toHaveText("–");
  await expect(skills.nth(2).locator('[data-track="rate"]')).toHaveCount(0);
  const id = "skill-releases-cut-without-the-release-skill";
  await row(page, id).hover();
  await expect(card(page, id).locator("[data-version]")).toHaveCount(3);
  await expect(card(page, id).locator('[data-version="c41d9e2"]')).toContainText("too few");
  expect(await sections(page)).toEqual(["verdict", "rate-now", "rate", "versions", "hand"]);
  await row(page, id).click();
  await expect(page).toHaveURL(new RegExp(`#${id}$`));
});

test("each row's status is one of four, from the verdict or the rule's check, each with its own icon", async ({
  page,
}) => {
  await openWide(page);
  const expected = {
    [WORKS]: ["works", "Works"],
    [PAST_SCALE]: ["not-working", "Not working"],
    [CANT_TELL]: ["cant-tell", "Can't tell"],
    [RUNNING]: ["not-enough", "Not enough tasks"],
    [SLIPPING]: ["not-working", "Not working"],
    [WAITING]: ["not-enough", "Not enough tasks"],
    // Its range crosses no change, yet it still reaches a 30% cut, so the rule works.
    [RULE]: ["works", "Works"],
  };
  for (const [id, [status, words]] of Object.entries(expected)) {
    await expect(row(page, id), id).toHaveAttribute("data-status", status);
    await expect(row(page, id).locator(`[data-status-icon="${status}"]`), id).toHaveAccessibleName(words);
  }
});

test("a row with not enough tasks draws no band and shows a dash, even when the report has its numbers", async ({
  page,
}) => {
  await openWide(page);
  expect(fixture.trials.find((t) => t.name === "Config read from memory")?.change).not.toBeNull();
  for (const id of [RUNNING, SCHEDULED, WAITING]) {
    await expect(row(page, id).locator('[data-track="change"]'), id).toHaveCount(0);
    await expect(row(page, id).locator("[data-change]"), id).toHaveText("–");
  }
});

test("pointing at a row shows its card, a click keeps it, and leaving the table returns to the kept one", async ({
  page,
}) => {
  await openWide(page);
  await row(page, RULE).hover();
  await expect(card(page, RULE)).toBeVisible();
  await row(page, WORKS).click();
  await expect(page).toHaveURL(new RegExp(`#${WORKS}$`));
  await expect(row(page, WORKS)).toHaveAttribute("aria-current", "true");
  await row(page, RULE).hover();
  await expect(card(page, RULE)).toBeVisible();
  await page.mouse.move(5, 5);
  await expect(card(page, WORKS)).toBeVisible();
  await row(page, RULE).hover();
  // The pointer can cross to the card without losing it.
  await card(page, RULE).hover();
  await page.waitForTimeout(400);
  await expect(card(page, RULE)).toBeVisible();
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
    [`#${RULE}`]: RULE,
    [`#/?m=${WORKS}`]: WORKS,
    "#/mistakes/long-logs-pasted-into-a-reply": RULE,
    "#/?m=mistake-long-logs-pasted-into-a-reply": RULE,
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
  await page.getByRole("link", { name: "All rules" }).click();
  await expect(page.locator("[data-table]").first()).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.getAttribute("data-row"))).toBe(WORKS);
  await row(page, RULE).click();
  await expect(card(page, RULE)).toBeVisible();
});

test("pointing at a status pill dims the other rows, and a click keeps only its rows", async ({ page }) => {
  await openWide(page);
  const opacity = (id: string) => row(page, id).evaluate((el) => getComputedStyle(el).opacity);
  await page.locator('[data-pill="works"]').hover();
  await expect.poll(() => opacity(RUNNING)).toBe("0.3");
  expect(await opacity(WORKS)).toBe("1");
  await page.mouse.move(5, 5);
  await expect.poll(() => opacity(RUNNING)).toBe("1");
  await page.locator('[data-pill="works"]').click();
  await expect(page.locator("[data-row]")).toHaveCount(3);
  await expect(page.locator('[data-row]:not([data-status="works"])')).toHaveCount(0);
  await expect(page.locator('[data-group="running"]')).toHaveCount(0);
  await expect(page.locator('[data-pill="works"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-pill="works"]').click();
  await expect(page.locator("[data-group] [data-row]")).toHaveCount(fixture.trials.length + fixture.permanent.length);
});

test("every card has its sections in one order, and a rule with not enough tasks stops after the second", async ({
  page,
}) => {
  const opened = await openWide(page);
  const expected = {
    [WORKS]: ["verdict", "trust", "change", "rate", "hand"],
    [CANT_TELL]: ["verdict", "trust", "change", "rate", "hand"],
    [RULE]: ["verdict", "trust", "change", "rate", "hand"],
    [RUNNING]: ["verdict", "trust"],
    [WAITING]: ["verdict", "trust"],
  };
  for (const [id, order] of Object.entries(expected)) {
    await page.goto(`${opened.url}#${id}`);
    await expect(card(page, id)).toBeVisible();
    expect(await sections(page), id).toEqual(order);
  }
  await expect(card(page, WAITING).locator("[data-verdict]")).toHaveText("Not enough tasks");
  // Beside the table the row already gives the number, so the card does not repeat it.
  await page.goto(`${opened.url}#${WORKS}`);
  await expect(card(page, WORKS).locator("[data-estimate]")).toBeHidden();
  await expect(card(page, WORKS).locator('[data-end="low"]')).toHaveText("−78%");
  await expect(card(page, WORKS).locator('[data-end="high"]')).toHaveText("−33%");
  await expect(card(page, WORKS).locator("[data-needed]")).toHaveText("90 needed");
  await page.goto(`${opened.url}#${RULE}`);
  await expect(card(page, RULE).locator("[data-needed]")).toHaveText("40 needed");
  // An active rule's chart runs over dates, a week apart back from the report's day.
  const ticks = card(page, RULE).locator('[data-section="rate"] .recharts-cartesian-axis-tick-value');
  await expect(ticks.first()).toBeVisible();
  expect((await ticks.allTextContents()).filter((t) => !t.endsWith("%"))).toEqual([
    "22 Oct",
    "29 Oct",
    "5 Nov",
    "12 Nov",
  ]);
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
  await page.goto(`${opened.url}#${RULE}`);
  const hand = card(page, RULE).locator('[data-section="hand"]');
  await expect(hand.locator("[data-misses] dd")).toHaveCount(5);
  await hand.getByRole("button", { name: "Copy for an agent" }).click();
  await expect(hand.getByRole("status")).toHaveText("Copied");
  const copied = String(await page.evaluate(() => (window as unknown as { copied: string }).copied));
  const check = fixture.permanent.find((c) => c.name === "Long logs pasted into a reply");
  expect(copied).toMatch(/^Find out why agents still make this mistake/);
  expect(copied).toContain("Long logs pasted into a reply");
  expect(copied).toContain("Works");
  for (const miss of check?.misses ?? []) expect(copied).toContain(miss.session);
  expect(check?.misses.length).toBeGreaterThan(0);
});

test("with no rule picked the card says how the numbers are made and what each mark means", async ({ page }) => {
  await openWide(page);
  const about = card(page, "page");
  await expect(about.getByRole("heading")).toHaveText("How these numbers are made");
  for (const mark of ["A band", "Dashed line on a band", "Dashed lines on a chart", "Tasks needed"]) {
    await expect(about.getByText(mark, { exact: true })).toBeVisible();
  }
});

test("a change larger than the scale stops at the edge with a mark", async ({ page }) => {
  await openWide(page);
  const band = row(page, PAST_SCALE).locator('[data-track="change"]');
  await expect(band.locator("[data-clipped]")).toBeVisible();
  await expect(row(page, PAST_SCALE).locator("[data-change]")).toHaveText("+133%");
  const { edge, dot } = await band.evaluate((track) => {
    const mark = track.querySelector("[data-value]")?.getBoundingClientRect();
    return { edge: track.getBoundingClientRect().right, dot: mark ? mark.left + mark.width / 2 : Number.NaN };
  });
  expect(Math.abs(dot - edge)).toBeLessThanOrEqual(1);
  await expect(row(page, WORKS).locator("[data-clipped]")).toHaveCount(0);
});

test("every band's dot sits at its value, under the same number in the header's scale", async ({ page }) => {
  await openWide(page);
  const tracks = await page.evaluate(() => {
    const box = (el: Element) => el.getBoundingClientRect();
    return [...document.querySelectorAll('[data-table] [data-track="change"], [data-table] [data-axis]')].map(
      (track) => ({
        axis: track.hasAttribute("data-axis"),
        left: box(track).left,
        width: box(track).width,
        marks: [...track.querySelectorAll("[data-value]")].map((mark) => ({
          value: Number(mark.getAttribute("data-value")),
          x: box(mark).left + box(mark).width / 2,
        })),
      }),
    );
  });
  expect(tracks.filter((t) => !t.axis).length).toBeGreaterThan(5);
  for (const track of tracks) {
    expect(Math.abs(track.left - tracks[0].left), "left edge").toBeLessThanOrEqual(0.5);
    expect(Math.abs(track.width - tracks[0].width), "width").toBeLessThanOrEqual(0.5);
    for (const mark of track.marks) {
      // The scale's two end numbers sit inside its edges, so only its middle numbers are centred on their place.
      if (track.axis && Math.abs(mark.value) === 1) continue;
      const at = (Math.min(1, Math.max(-1, mark.value)) + 1) / 2;
      expect(Math.abs(mark.x - (track.left + at * track.width)), `${mark.value}`).toBeLessThanOrEqual(1);
    }
  }
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

test("live now counts what is measured first, and its folded lists link to the rows", async ({ page }) => {
  await openWide(page);
  const live = page.locator("[data-live]");
  await expect(live.locator('[data-count="Rule lines"]')).toContainText("2 of 5");
  await expect(live.locator('[data-count="Skills"]')).toContainText("2 of 3");
  await expect(live.getByText("Fix the cause")).toBeHidden();
  await live.getByText("Not measured (4)").click();
  await expect(live.getByText("Fix the cause")).toBeVisible();
  await live.getByText("Measured (4)", { exact: true }).click();
  await live.locator("li", { hasText: "Run the tests before a commit" }).getByRole("link").click();
  await expect(card(page, WORKS)).toBeVisible();
  const skill = live.locator("li", { hasText: "code-review" }).getByRole("link");
  await expect(skill).toHaveText(/% missed$/);
  await skill.click();
  await expect(card(page, "skill-reviews-done-without-the-review-skill")).toBeVisible();
});

test("a report without the installed rules shows no live now section", async ({ page }) => {
  await page.setViewportSize(widths.desktop);
  await openBuilt(page, { ...fixture, live: null });
  await expect(page.locator("[data-live]")).toHaveCount(0);
});
