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
