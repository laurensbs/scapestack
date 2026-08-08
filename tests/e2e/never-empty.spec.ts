import { expect, test } from "@playwright/test";

/**
 * The product is never blank — docs/SCAPESTACK-REBUILD-2026-08-02.md, Task 7.
 *
 * Two promises, asserted on a production build:
 *  1. A first visit with no RSN sees a populated page: the positioning, the
 *     day's boss render, real counts — before typing anything.
 *  2. A player page for an account we have never synced still answers from
 *     hiscores alone. It does not become a connect-wall.
 *
 * If either fails, fix the state, not the assertion.
 */

test.describe("never empty", () => {
  test("/ without an RSN is a populated page, not an empty funnel", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Your OSRS companion." })).toBeVisible();
    await expect(page.getByPlaceholder(/your osrs name/i)).toBeVisible();
    // The day-seeded boss render is the page's subject; it must actually
    // have pixels, not just a slot.
    const subject = page.locator("[data-home-boss-subject]");
    await expect(subject).toBeVisible();
    await expect(page.getByText(/Today's boss ·/)).toBeVisible();
    await expect.poll(async () => subject.locator("img").evaluate(
      (img: HTMLImageElement) => img.naturalWidth
    ), { timeout: 10_000 }).toBeGreaterThan(0);
  });

  test("a never-synced account still gets an answer from hiscores alone", async ({ page }) => {
    // Lynx Titan: permanently on the hiscores, never synced with Scapestack.
    await page.goto("/p/Lynx%20Titan");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.locator("[data-hiscores-retry]"),
      "the hiscores retry state is on screen — Jagex did not answer during this run, so the never-empty promise is unmeasurable; rerun when the hiscores are up"
    ).toHaveCount(0);
    // The plan section answers — either a real recommendation or the honest
    // no-plan state; both carry the marker, neither is a wall.
    await expect(page.locator("[data-player-plan-answer]")).toBeVisible();
    // The page says what Scapestack knows and what would change it. Which of
    // the three coverage states applies depends on whether anyone has ever
    // synced this RSN — asserting one state's copy made this test a hostage to
    // the contents of the database. The promise is that the line is there.
    const coverage = page.locator("[data-account-coverage]");
    await expect(coverage).toBeVisible();
    await expect(coverage).toHaveText(/connect RuneLite|This is me|Hiscores \+ RuneLite/);
  });
});
