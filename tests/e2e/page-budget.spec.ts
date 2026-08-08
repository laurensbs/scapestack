import { expect, test, type Page } from "@playwright/test";

/**
 * The page budget for /p/[rsn]. This spec IS the design system's enforcement
 * arm: docs/SCAPESTACK-REBUILD-2026-08-02.md, Task 0.
 *
 * Measured on production /p/lauky, 2026-08-08, the day this spec was written —
 * every one of these numbers shipped through a green ci:check, because no gate
 * opened the page:
 *
 *   page height        4,828px @ 1280   /  5,450px @ 390     (budget 2200/2800)
 *   sections           7                                      (budget 3)
 *   images             56, of which 39 had an EMPTY src       (budget ≤20, 0 empty)
 *   sprite scaling     16–30px sources in ~64px boxes         (≥32px source at ≥40px display)
 *   font sizes         7 distinct — 11.5px x4 off scale       (budget: the tokens, exactly)
 *   weight 600         148 of 269 text-bearing elements, 55%  (budget ≤35%)
 *   text colours       7 distinct                             (budget ≤5)
 *   first action       y=1,253 — below every fold             (budget: above the fold)
 *
 * Thresholds only ratchet DOWN. If a change needs a bigger budget, the change
 * is wrong — see the three-section rule in CLAUDE.md.
 *
 * First local run against a production build, 2026-08-08: 8 of 10 assertions
 * red across both viewports (mobile height 5,425px @412, images 56, 12.5px x3
 * off scale). The above-fold assertion passed on day one — not vacuously, but
 * because the goal-search input genuinely sits high enough; it stays as the
 * floor that Task 1's demolition must not break.
 */

const PAGE_PATH = "/p/lauky";

// The six Archivo tokens plus the two RuneStar sizes (--text-rs 16px,
// --text-rs-display 32px), added in the same commit as those tokens — the
// bitmap faces are pixel-crisp only at multiples of 16, so these two are the
// only sizes they exist at.
const ALLOWED_FONT_SIZES = new Set(["11px", "12px", "14px", "16px", "19px", "28px", "32px", "40px"]);
const MAX_SECTIONS = 3;
const MAX_IMAGES = 20;
const MAX_TEXT_COLOURS = 5;
const MAX_SEMIBOLD_SHARE = 0.35;

interface PageAudit {
  height: number;
  viewport: { width: number; height: number };
  sections: string[];
  images: { total: number; emptySrc: number; upscaled: string[] };
  fontSizes: Record<string, number>;
  weights: Record<string, number>;
  textBearingCount: number;
  colours: string[];
  horizontalOverflow: number;
  firstActionsAboveFold: string[];
}

async function auditPage(page: Page): Promise<PageAudit> {
  await page.goto(PAGE_PATH);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Let fonts and images settle before measuring — with bounded waits, not
  // networkidle: that one can hang past the test timeout and kill the
  // evaluate mid-flight, which reads as a budget failure that isn't one.
  await page.waitForFunction(() => document.fonts.status === "loaded", undefined, { timeout: 8_000 }).catch(() => undefined);
  await page.waitForFunction(
    () => [...document.images].every((img) => img.complete || img.loading === "lazy"),
    undefined,
    { timeout: 8_000 }
  ).catch(() => undefined);
  return page.evaluate(() => {
    const textBearing: Element[] = [];
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest("script,style,noscript")) continue;
      // Chrome keeps layout boxes for content inside a closed <details>
      // (content-visibility), so a rect check alone counts text nobody can
      // see. The reader's page is what is open.
      const details = el.closest("details:not([open])");
      if (details && !el.closest("summary")) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      const hasText = [...el.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim().length > 0
      );
      if (hasText) textBearing.push(el);
    }
    const fontSizes: Record<string, number> = {};
    const weights: Record<string, number> = {};
    const colours = new Set<string>();
    for (const el of textBearing) {
      const cs = getComputedStyle(el);
      fontSizes[cs.fontSize] = (fontSizes[cs.fontSize] ?? 0) + 1;
      weights[cs.fontWeight] = (weights[cs.fontWeight] ?? 0) + 1;
      colours.add(cs.color);
    }
    const images = [...document.querySelectorAll("img")];
    const upscaled = images
      .filter((img) => {
        const rect = img.getBoundingClientRect();
        return Math.max(rect.width, rect.height) >= 40 && img.naturalWidth > 0 && img.naturalWidth < 32;
      })
      .map((img) => `${img.currentSrc.slice(-48)} (${img.naturalWidth}px shown at ${Math.round(img.getBoundingClientRect().width)}px)`);
    const actionable = [...document.querySelectorAll<HTMLElement>(
      "main a[href], main button, main input, main select, main [role='button']"
    )]
      .map((el) => ({
        y: el.getBoundingClientRect().top + window.scrollY,
        label: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 60) ||
          (el as HTMLInputElement).placeholder?.slice(0, 60) || el.tagName.toLowerCase()
      }))
      .filter((entry) => entry.label.length > 0)
      .sort((a, b) => a.y - b.y);
    return {
      height: document.body.scrollHeight,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      sections: [...document.querySelectorAll("main section")].map(
        (section) => section.getAttribute("aria-labelledby") ?? section.getAttribute("aria-label") ?? section.tagName
      ),
      images: {
        total: images.length,
        emptySrc: images.filter((img) => !img.getAttribute("src") && !img.currentSrc).length,
        upscaled
      },
      fontSizes,
      weights,
      textBearingCount: textBearing.length,
      colours: [...colours],
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      firstActionsAboveFold: actionable
        .filter((entry) => entry.y < window.innerHeight)
        .map((entry) => entry.label)
    };
  });
}

test.describe("the /p/[rsn] page budget", () => {
  test("height stays inside the budget", async ({ page, isMobile }) => {
    const audit = await auditPage(page);
    const budget = isMobile ? 2800 : 2200;
    expect(
      audit.height,
      `page is ${audit.height}px at ${audit.viewport.width}px wide — budget is ${budget}px`
    ).toBeLessThanOrEqual(budget);
  });

  test("the page holds at most three sections", async ({ page }) => {
    const audit = await auditPage(page);
    expect(
      audit.sections.length,
      `sections found: ${audit.sections.join(", ")}`
    ).toBeLessThanOrEqual(MAX_SECTIONS);
  });

  test("every image is real and drawn at a size its source can carry", async ({ page }) => {
    const audit = await auditPage(page);
    expect(audit.images.emptySrc, "images with an empty src render as holes").toBe(0);
    expect(audit.images.total, "image count").toBeLessThanOrEqual(MAX_IMAGES);
    expect(audit.images.upscaled, "sprites blown up past their source resolution").toEqual([]);
  });

  test("type stays on the scale, and semibold stays scarce", async ({ page }) => {
    const audit = await auditPage(page);
    const offScale = Object.entries(audit.fontSizes).filter(([size]) => !ALLOWED_FONT_SIZES.has(size));
    expect(offScale, `off-scale font sizes: ${offScale.map(([s, n]) => `${s} x${n}`).join(", ")}`).toEqual([]);
    const semibold = (audit.weights["600"] ?? 0) + (audit.weights["700"] ?? 0);
    const share = semibold / Math.max(1, audit.textBearingCount);
    expect(
      share,
      `weight 600/700 on ${semibold} of ${audit.textBearingCount} text-bearing elements (${Math.round(share * 100)}%)`
    ).toBeLessThanOrEqual(MAX_SEMIBOLD_SHARE);
    expect(
      audit.colours.length,
      `distinct text colours: ${audit.colours.join(" ")}`
    ).toBeLessThanOrEqual(MAX_TEXT_COLOURS);
  });

  test("something to act on sits above the fold, and nothing overflows", async ({ page }) => {
    const audit = await auditPage(page);
    expect(audit.horizontalOverflow, "horizontal overflow in px").toBeLessThanOrEqual(2);
    const beyondConnect = audit.firstActionsAboveFold.filter(
      (label) => !/connect runelite/i.test(label)
    );
    expect(
      beyondConnect.length,
      `above the fold the player can only: ${audit.firstActionsAboveFold.join(" | ") || "do nothing"}`
    ).toBeGreaterThan(0);
  });
});
