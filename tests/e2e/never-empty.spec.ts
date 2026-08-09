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
    await expect(page.getByRole("heading", { name: "Stop bankstanding." })).toBeVisible();
    // The field now carries a VISIBLE label ("Your name in Gielinor") where it
    // used to have an sr-only one and a "Your OSRS name" placeholder. Finding
    // it by label rather than by placeholder is both more robust and the
    // accurate description: a placeholder is an example, not a name.
    await expect(page.getByLabel(/name in Gielinor/i)).toBeVisible();
    // The day-seeded boss render is the page's subject; it must actually
    // have pixels, not just a slot.
    const subject = page.locator("[data-home-boss-subject]");
    await expect(subject).toBeVisible();
    await expect(page.getByText(/Today's boss ·/)).toBeVisible();
    await expect.poll(async () => subject.locator("img").evaluate(
      (img: HTMLImageElement) => img.naturalWidth
    ), { timeout: 10_000 }).toBeGreaterThan(0);
  });

  test("/next with nothing typed shows a real plan, not a promise of one", async ({ page }) => {
    // SPEC §3.4: no page renders a bare input and one sentence. The proof
    // that this is the engine and not a screenshot is that the trip has the
    // same structure a real answer has — a decision, and what to do about it.
    await page.goto("/next");
    const preview = page.locator("[data-demo-plan-preview]");
    await expect(preview).toBeVisible();
    await expect(preview.getByRole("heading", { level: 2 })).not.toBeEmpty();
    // The property is unchanged — the briefing says where you go and when you
    // stop. REBRAND 6.2 moved it out of a Start / Stop-at table and into an
    // AdventureBrief, so the same two facts now live in a <dl>.
    await expect(preview.getByText("You set off:")).toBeVisible();
    await expect(preview.getByText("Come home when:")).toBeVisible();

    // The old copy told the player to do the one thing the cursor already
    // told them. If it comes back, this fails.
    await expect(page.getByText("Enter an OSRS name to get one clear next move")).toHaveCount(0);

    // A slug is a path segment, not a word — "vardorvis is already at 15 KC"
    // reached production. The property is that whatever is named in that
    // clause is capitalised the way a player writes it. A blanket ban on
    // hyphenated lowercase words was the first shape of this and it flagged
    // "mid-session", which is just English.
    const body = (await preview.textContent()) ?? "";
    const named = body.match(/(\S+) is already at/);
    if (named) expect(named[1]).toMatch(/^[A-Z]/);
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
