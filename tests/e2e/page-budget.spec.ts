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

// The legal (family, size) pairs live inside auditPage: the six Archivo
// tokens for everything, 16/32/48px for the RuneStar bitmap faces only. A
// flat size set had no family axis — Archivo at 16px passed off-system.
const MAX_SECTIONS = 3;
const MAX_IMAGES = 20;
const MAX_TEXT_COLOURS = 5;
const MAX_SEMIBOLD_SHARE = 0.35;

interface PageAudit {
  height: number;
  expandedHeight: number;
  goalControlY: number;
  altsShare: number;
  doubledRules: string[];
  viewport: { width: number; height: number };
  sections: string[];
  images: { total: number; emptySrc: number; broken: string[]; upscaled: string[] };
  fontSizes: Record<string, number>;
  familyViolations: string[];
  weights: Record<string, number>;
  loudCount: number;
  textBearingCount: number;
  colours: string[];
  horizontalOverflow: number;
  firstActionsAboveFold: string[];
}

async function auditPage(page: Page, options: { navigate?: boolean } = {}): Promise<PageAudit> {
  if (options.navigate !== false) await page.goto(PAGE_PATH);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // The retry state also has an h1 and passes every budget below trivially —
  // 0 sections, 0 images, one screen tall. Without this anchor a hiscores
  // blip greens the audit against the wrong page, which is the exact
  // "a deploy check that polls for HTTP 200 approves the previous build"
  // failure this repo already shipped once.
  await expect(
    page.locator("[data-hiscores-retry]"),
    "the hiscores retry state is on screen — Jagex did not answer during this audit, so every budget number would measure the wrong page; rerun when the hiscores are up"
  ).toHaveCount(0);
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
    // Everything readable counts, INCLUDING content folded inside a closed
    // <details> — the 2026-08-08 adversarial pass showed the whole demolished
    // page could otherwise return behind one <summary>, invisible to every
    // metric except image count.
    const textBearing: Element[] = [];
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest("script,style,noscript")) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0 && !el.closest("details:not([open])")) continue;
      const hasText = [...el.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim().length > 0
      );
      if (hasText) textBearing.push(el);
    }
    const fontSizes: Record<string, number> = {};
    const familyViolations: string[] = [];
    const weights: Record<string, number> = {};
    const colours = new Set<string>();
    let loudCount = 0;
    // The scale has a family axis: the RuneStar bitmap faces exist ONLY at
    // 16/32/48px (their pixel grid breaks anywhere else), and the Archivo
    // tokens are everything else's whole scale. A size that is legal for one
    // family is off-system for the other.
    const RS_FAMILY = /rs(plain|bold|quill)/i;
    const RS_SIZES = new Set(["16px", "32px", "48px"]);
    const ARCHIVO_SIZES = new Set(["11px", "12px", "14px", "19px", "28px", "40px"]);
    // Known limit: the colour count keys on computed `color` and does not
    // fold in `opacity` tints — nothing on the page uses opacity on text
    // today, and folding alpha would mis-count anti-aliased edges. If text
    // opacity ever appears, extend this to composite the effective colour.
    for (const el of textBearing) {
      const cs = getComputedStyle(el);
      fontSizes[cs.fontSize] = (fontSizes[cs.fontSize] ?? 0) + 1;
      const isRs = RS_FAMILY.test(cs.fontFamily.split(",")[0] ?? "");
      const legal = isRs ? RS_SIZES : ARCHIVO_SIZES;
      if (!legal.has(cs.fontSize)) {
        familyViolations.push(`${cs.fontFamily.split(",")[0]} at ${cs.fontSize}: "${(el.textContent ?? "").trim().slice(0, 30)}"`);
      }
      weights[cs.fontWeight] = (weights[cs.fontWeight] ?? 0) + 1;
      if (Number(cs.fontWeight) >= 800) loudCount += 1;
      colours.add(cs.color);
    }
    const images = [...document.querySelectorAll("img")];
    // A src that 404s has a truthy attribute, complete=true and naturalWidth
    // 0 — the exact spelling of the 39-holes incident this spec was written
    // for. Pending lazy images (complete=false) are not blamed.
    const broken = images
      .filter((img) => img.complete && img.naturalWidth === 0)
      .map((img) => (img.getAttribute("src") ?? "(no src)").slice(-60));
    const upscaled = images
      .filter((img) => {
        const rect = img.getBoundingClientRect();
        return Math.max(rect.width, rect.height) >= 40 && img.naturalWidth > 0 && img.naturalWidth < 32;
      })
      .map((img) => `${img.currentSrc.slice(-48)} (${img.naturalWidth}px shown at ${Math.round(img.getBoundingClientRect().width)}px)`);
    // globals.css sets overflow-x: clip on html/body, which excludes clipped
    // content from scrollWidth — the naive scrollWidth-clientWidth check can
    // NEVER fail there. Walk the real right edges instead.
    let maxRight = 0;
    for (const el of document.querySelectorAll("body *")) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (rect.right > maxRight) maxRight = rect.right;
    }
    const horizontalOverflow = Math.max(0, Math.ceil(maxRight - document.documentElement.clientWidth));
    const actionable = [...document.querySelectorAll<HTMLElement>(
      "main a[href], main button, main input, main select, main [role='button']"
    )]
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.height > 0 && getComputedStyle(el).visibility !== "hidden";
      })
      .map((el) => ({
        y: el.getBoundingClientRect().top + window.scrollY,
        label: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 60) ||
          (el as HTMLInputElement).placeholder?.slice(0, 60) || el.tagName.toLowerCase()
      }))
      .filter((entry) => entry.label.length > 0)
      .sort((a, b) => a.y - b.y);
    const collapsedHeight = document.body.scrollHeight;
    // A fold is for a short remainder, not a hiding place: open everything
    // and measure again. The expanded page gets a bounded allowance.
    const allDetails = [...document.querySelectorAll("details")];
    const wasOpen = allDetails.map((d) => d.open);
    for (const d of allDetails) d.open = true;
    const expandedHeight = document.body.scrollHeight;
    allDetails.forEach((d, i) => { d.open = wasOpen[i]; });
    const goalControl = document.querySelector("[data-goal-bar] summary");
    const answer = document.querySelector('[data-player-plan-answer="true"]');
    const alts = document.querySelector("[data-player-plan-alternatives]");
    const answerH = answer ? answer.getBoundingClientRect().height : 0;
    const altsH = alts ? alts.getBoundingClientRect().height : 0;
    // Two rules close together are one box ending and another starting —
    // but only at SECTION level. The first version of this walked every
    // element in main and flagged consecutive rows of a list or table as
    // stacked rules, which is a list doing its job, not a panel. Only
    // top-level blocks inside <main> can bound a section.
    const edges: Array<{ y: number; what: string }> = [];
    const sectionLevel = new Set<Element>();
    const main = document.querySelector("main");
    for (const child of main ? [...main.children] : []) {
      sectionLevel.add(child);
      for (const grandchild of child.children) sectionLevel.add(grandchild);
    }
    for (const el of sectionLevel) {
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (rect.width < document.documentElement.clientWidth * 0.6) continue;
      if (cs.borderTopWidth !== "0px" && cs.borderTopStyle !== "none") {
        edges.push({ y: Math.round(rect.top + window.scrollY), what: el.tagName.toLowerCase() + " top" });
      }
      if (cs.borderBottomWidth !== "0px" && cs.borderBottomStyle !== "none") {
        edges.push({ y: Math.round(rect.bottom + window.scrollY), what: el.tagName.toLowerCase() + " bottom" });
      }
    }
    edges.sort((a, b) => a.y - b.y);
    const doubledRules: string[] = [];
    for (let i = 1; i < edges.length; i++) {
      const gap = edges[i].y - edges[i - 1].y;
      if (gap > 0 && gap < 40) doubledRules.push(`${edges[i - 1].what}@${edges[i - 1].y} + ${edges[i].what}@${edges[i].y}`);
    }
    return {
      height: collapsedHeight,
      expandedHeight,
      goalControlY: goalControl ? Math.round(goalControl.getBoundingClientRect().top + window.scrollY) : Number.MAX_SAFE_INTEGER,
      altsShare: answerH > 0 ? altsH / answerH : 0,
      doubledRules,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      sections: [...document.querySelectorAll("main section")].map(
        (section) => section.getAttribute("aria-labelledby") ?? section.getAttribute("aria-label") ?? section.tagName
      ),
      images: {
        total: images.length,
        emptySrc: images.filter((img) => !img.getAttribute("src") && !img.currentSrc).length,
        broken,
        upscaled
      },
      fontSizes,
      familyViolations,
      weights,
      loudCount,
      textBearingCount: textBearing.length,
      colours: [...colours],
      horizontalOverflow,
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
    // A fold is a short remainder, not a hiding place: with every <details>
    // opened the page gets a bounded allowance, not an exemption.
    expect(
      audit.expandedHeight,
      `page is ${audit.expandedHeight}px with all details open — allowance is ${budget + 1000}px`
    ).toBeLessThanOrEqual(budget + 1000);
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
    expect(audit.images.broken, "images whose src loaded nothing (404s render as holes too)").toEqual([]);
    expect(audit.images.total, "image count").toBeLessThanOrEqual(MAX_IMAGES);
    expect(audit.images.upscaled, "sprites blown up past their source resolution").toEqual([]);
  });

  test("type stays on the scale, and semibold stays scarce", async ({ page }) => {
    const audit = await auditPage(page);
    expect(
      audit.familyViolations,
      `off-system (family, size) pairs: ${audit.familyViolations.join(" | ")}`
    ).toEqual([]);
    // Everything from 600 up counts toward the scarcity budget — the 55%
    // semibold defect must not come back one notch heavier as 800.
    const semibold = Object.entries(audit.weights)
      .filter(([weight]) => Number(weight) >= 600)
      .reduce((sum, [, count]) => sum + count, 0);
    const share = semibold / Math.max(1, audit.textBearingCount);
    // And 800+ is the ONE loud element per screen, by definition.
    expect(audit.loudCount, "elements at weight 800 or heavier").toBeLessThanOrEqual(1);
    expect(
      share,
      `weight 600/700 on ${semibold} of ${audit.textBearingCount} text-bearing elements (${Math.round(share * 100)}%)`
    ).toBeLessThanOrEqual(MAX_SEMIBOLD_SHARE);
    expect(
      audit.colours.length,
      `distinct text colours: ${audit.colours.join(" ")}`
    ).toBeLessThanOrEqual(MAX_TEXT_COLOURS);
  });

  test("the goal control is above the fold, and rejecting costs less than answering", async ({ page }) => {
    const audit = await auditPage(page);
    // The goal is what makes the page yours. It sat third, below the fold,
    // behind the answer and a "Not this?" table; a player had to scroll past
    // the verdict to state an intention.
    expect(
      audit.goalControlY,
      `the goal control is at y=${audit.goalControlY}, fold at ${audit.viewport.height}`
    ).toBeLessThan(audit.viewport.height);
    // The alternatives were 211px against the answer's 286px — rejecting the
    // answer got more vertical space than stating it.
    expect(
      audit.altsShare,
      `alternatives are ${Math.round(audit.altsShare * 100)}% of the answer's height`
    ).toBeLessThanOrEqual(0.2);
    // One hairline per boundary. Two full-width rules 20px apart read as the
    // bottom of one box and the top of another — the most panel-shaped thing
    // a document can do.
    expect(
      audit.doubledRules,
      `full-width rules stacked within 40px: ${audit.doubledRules.join(", ")}`
    ).toEqual([]);
  });

  test("the budget still holds once a goal is pinned", async ({ page }) => {
    // A budget that only ever measures the resting state approves a state
    // nobody uses — the same shape as a deploy check that polls for HTTP 200
    // and approves the previous build. Pinning used to render
    // .scape-verdict[data-gate="ready"] (#40FF00), a sixth text colour on a
    // page budgeted to five, and no assertion in this file had ever entered
    // that state.
    await page.goto(PAGE_PATH);
    await page.locator("[data-goal-bar] summary").click();
    const choice = page.locator("[data-goal-choice]").first();
    await expect(choice).toBeVisible();
    await choice.click();
    await expect(page.locator("[data-goal-bar]")).toHaveAttribute("data-goal-bar", "pinned");

    // The pin has to LAND, without a reload. The goals panel read storage once
    // on mount and never listened for PINNED_GOALS_EVENT, so pinning left the
    // roster below reading "Nothing pinned" while localStorage already held
    // the goal — and the product's only Remove control was a page load behind
    // the truth. Pinning is the moment the whole goal system exists for.
    const pinnedName = (await page.locator("[data-goal-bar] summary").innerText()).trim();
    await expect(page.locator("[data-pinned-goals]")).toContainText(
      pinnedName.split("\n")[1] ?? pinnedName,
      { timeout: 5_000 }
    );

    const audit = await auditPage(page, { navigate: false });
    const budget = audit.viewport.width < 700 ? 2800 : 2200;
    expect(audit.height, `pinned page is ${audit.height}px`).toBeLessThanOrEqual(budget);
    expect(audit.colours.length, `pinned: ${audit.colours.join(" ")}`).toBeLessThanOrEqual(MAX_TEXT_COLOURS);
    expect(audit.familyViolations).toEqual([]);
    expect(audit.loudCount).toBeLessThanOrEqual(1);
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
