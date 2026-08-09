import { expect, test } from "@playwright/test";

/**
 * A goal the page offers must be a goal the page can measure.
 *
 * The goal line's whole promise is "you are X% to your goal". An audit found
 * that on a live player page the one-click suggestions were item and unlock
 * goals — kinds whose progress needs a RuneLite sync — so for a visitor who
 * has never paired, the page's own suggestions were the ones it could not
 * answer. Pinning one produced a goal with no number next to it.
 *
 * Lynx Titan: permanently on the hiscores, never paired with Scapestack, so
 * this is the unpaired viewer's experience and not the developer's.
 */

const PAGE = "/p/Lynx%20Titan";

test.describe("every offered goal can be measured", () => {
  test("filtering never leaves the picker empty", async ({ page }) => {
    // The first version of the filter simply dropped unmeasurable kinds, and
    // for an account whose every suggestion needed RuneLite that left nothing
    // to pin at all. A goal line offering nothing is worse than one offering a
    // goal it cannot measure — it is the control the whole return loop hangs
    // off. Two accounts, because the defect only showed on one of them.
    for (const path of ["/p/lauky", "/p/Lynx%20Titan"]) {
      await page.goto(path);
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
      await page.locator("[data-goal-bar] summary").click();
      await expect(
        page.locator("[data-goal-choice]").first(),
        `${path} offers nothing to pin`
      ).toBeVisible();
    }
  });

  test("each one-click suggestion produces a number once pinned", async ({ page }) => {
    await page.goto(PAGE);
    await page.locator("[data-goal-bar] summary").click();

    const keys = await page.locator("[data-goal-choice]").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-goal-choice") ?? ""));
    expect(keys.length, "the goal line offered nothing to pin").toBeGreaterThan(0);

    const unmeasurable: string[] = [];
    for (const key of keys) {
      await page.goto(PAGE);
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
      await page.locator("[data-goal-bar] summary").click();

      const choice = page.locator(`[data-goal-choice="${key}"]`);
      await expect(choice).toBeVisible();
      await choice.click();
      await expect(page.locator("[data-goal-bar]")).toHaveAttribute("data-goal-bar", "pinned");

      // The number next to the goal. Absent means the page is carrying a goal
      // it has no reading for — which is what the promise above is made of.
      const progress = page.locator("[data-goal-bar] [data-goal-progress]");
      if ((await progress.count()) === 0) unmeasurable.push(key);
    }

    expect(
      unmeasurable,
      `offered but unmeasurable for an unpaired viewer: ${unmeasurable.join(", ")}`
    ).toEqual([]);
  });
});
