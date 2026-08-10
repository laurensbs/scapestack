import { expect, test } from "@playwright/test";

/**
 * One shell on every route: the nav, and the licence notice.
 *
 * Both are legal or navigational obligations rather than design preferences,
 * and both have already drifted once — an audit found "Today · Setup · Boss"
 * on four routes and "Today · Kit · Bestiary" on two, which turned out to be a
 * rollout snapshot but would have been indistinguishable from a real split.
 *
 * The licence text is asserted VERBATIM. A paraphrase of a licence notice is
 * not the licence notice, and an earlier version of this footer dropped
 * "Limited", "under the terms of" and "This content" — three words the Fan
 * Content Policy prescribes and a code review will not miss for you.
 *
 * It reads innerText rather than the raw HTML, and that distinction is the
 * reason this comment exists. A first pass at checking the footer stripped
 * tags with a regex that replaced each one with a SPACE, so `</a>` became the
 * space it was looking for and the check reported a defect on all seven routes
 * that did not exist. The browser collapses that whitespace; innerText is what
 * a player actually reads, so innerText is what gets asserted.
 */

const ROUTES = ["/", "/next", "/bank", "/dps", "/slayer", "/plugin", "/goals"];

const LICENCE =
  "Item and skill icons from the OSRS Wiki, CC BY-NC-SA 3.0, reused here under the same licence. "
  + "Created using intellectual property belonging to Jagex Limited under the terms of Jagex's Fan Content Policy. "
  + "This content is not endorsed by or affiliated with Jagex.";

test.describe("one shell, every route", () => {
  for (const route of ROUTES) {
    test(`${route} carries the nav and the licence`, async ({ page }) => {
      await page.goto(route);

      // Exactly these three, exactly these destinations.
      for (const [label, href] of [["Today", "/next"], ["Kit", "/bank"], ["Bestiary", "/dps"]] as const) {
        const link = page.locator("nav a").filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) });
        await expect(link.first(), `${route}: ${label} missing`).toBeAttached();
        await expect(link.first()).toHaveAttribute("href", new RegExp(`^${href}`));
      }

      // The labels the rebrand replaced. Scoped to nav, because "Boss" is a
      // correct table-column heading elsewhere on these very pages.
      await expect(
        page.locator("nav a").filter({ hasText: /^\s*(Setup|Boss)\s*$/ }),
        `${route}: an old nav label came back`
      ).toHaveCount(0);

      // Verbatim, whitespace-normalised — the failure being guarded is a
      // stray space, so the comparison collapses runs of whitespace and
      // nothing else.
      const footer = (await page.locator("footer").innerText()).replace(/\s+/g, " ").trim();
      expect(footer, `${route}: licence notice is not verbatim`).toContain(LICENCE);
    });
  }
});
