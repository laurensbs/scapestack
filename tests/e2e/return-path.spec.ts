import { expect, test } from "@playwright/test";

/**
 * The way back, and the entry points that promised content.
 *
 * An audit of the live site found the return path missing entirely: a player
 * who typed their name yesterday has it in localStorage today and the chrome
 * carried no link to the page it built for them. It also found "Setup",
 * "Boss" and "Task" resolving to one byte-identical bank form — three labels,
 * one destination, no bosses on the page about bosses.
 */

const RSN = "lauky";

test.describe("the way back to your own page", () => {
  for (const viewport of [
    { name: "desktop", width: 1280, height: 900 },
    { name: "mobile", width: 390, height: 844 }
  ]) {
    test(`a saved name gets a link to its page — ${viewport.name}`, async ({ page }) => {
      // Both breakpoints, because the desktop nav is `hidden sm:flex` and the
      // phone drawer is a separate tree. A fix applied to one passes one test
      // and leaves the other half of the audience with no route back.
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      // The real key, read from src/lib/saved-bank.ts. A guess here would
      // make this test pass against a header that never sees a saved name.
      await page.evaluate((rsn) => {
        window.localStorage.setItem("scapestack:saved-rsn:v1", rsn);
      }, RSN);
      await page.reload();

      if (viewport.width < 640) {
        await page.getByRole("button", { name: /open menu/i }).click();
      }
      // `:visible`, because the header carries the link in two trees — the
      // desktop nav is `hidden sm:flex` and the drawer is `sm:hidden`, so both
      // are in the DOM at every width and only one is on screen. Asserting on
      // the DOM alone would pass for a mobile user who can see neither.
      const link = page.locator("[data-my-page-link]:visible");
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute("href", `/p/${RSN}`);
    });
  }

  test("nothing to go back to means no link", async ({ page }) => {
    // "My page" pointing at a page for nobody is worse than an absence.
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expect(page.locator("[data-my-page-link]")).toHaveCount(0);
  });
});

test.describe("a second reason to open the page", () => {
  test("Check again reads the hiscores and says what moved", async ({ page }) => {
    // /api/account/refresh had been public, rate-limited and self-registering
    // with no caller anywhere in the product. Every click also writes a
    // hiscore_snapshot row, which is what the recap, the goal percentage and
    // the milestone ledger all read — so this control is both the reason to
    // return and the thing that makes returning measurable.
    await page.goto("/p/Lynx%20Titan");
    const control = page.locator("[data-account-refresh] button");
    await expect(control).toBeVisible();

    const answered = page.waitForResponse((response) =>
      response.url().includes("/api/account/refresh") && response.request().method() === "POST");
    await control.click();
    const response = await answered;

    // The rate limit is one per RSN per ten minutes, shared across browsers
    // and across runs. Asserting 200 made this test fail whenever it ran twice
    // in a window — a flaky gate, which is worse than none.
    //
    // So the always-true property is asserted every run: the control calls the
    // endpoint and RENDERS WHAT COMES BACK. That cannot pass on a no-op — a
    // component that swallowed the answer shows no line at all. Which line is
    // correct then depends on the status, and any status other than these two
    // is a failure rather than a shrug.
    const result = page.locator("[data-refresh-result]");
    await expect(result).toBeVisible({ timeout: 15_000 });

    if (response.status() === 200) {
      await expect(result).toHaveText(/\+[\d.,]+[kM]? xp|Nothing moved|First reading/);
    } else if (response.status() === 429) {
      await expect(result).toHaveText(/Already checked/);
    } else {
      throw new Error(`refresh answered ${response.status()}: ${await response.text()}`);
    }
  });
});

test.describe("three labels, three destinations", () => {
  const SECTIONS = [
    { path: "/dps", section: "bosses", heading: /can i kill this/i },
    { path: "/slayer", section: "task", heading: /is this task worth it/i },
    { path: "/goals", section: "sets", heading: /what can this bank finish/i }
  ];

  for (const entry of SECTIONS) {
    test(`${entry.path} answers its own question, before any paste`, async ({ page }) => {
      await page.goto(entry.path);
      // "Bank setup / Add bank once" is what all three used to render.
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(entry.heading);
      await expect(page.locator(`[data-section-roster="${entry.section}"]`)).toBeVisible();
    });
  }

  test("the three do not render the same page", async ({ page }) => {
    // The audit diffed the rendered text of two of these and found them
    // byte-identical. That is the assertion, not a proxy for it.
    const seen = new Set<string>();
    for (const entry of SECTIONS) {
      await page.goto(entry.path);
      const text = (await page.locator("main").innerText()).trim();
      expect(text.length, `${entry.path} rendered almost nothing`).toBeGreaterThan(200);
      expect(seen.has(text), `${entry.path} renders text identical to an earlier section`).toBe(false);
      seen.add(text);
    }
  });

  test("the boss page has bosses on it", async ({ page }) => {
    await page.goto("/dps");
    const roster = page.locator('[data-section-roster="bosses"]');
    await expect(roster.getByText("Vorkath", { exact: false }).first()).toBeVisible();
    await expect(roster.getByText("Zulrah", { exact: false }).first()).toBeVisible();
  });
});
