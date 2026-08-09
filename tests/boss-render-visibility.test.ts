import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import contrast from "../data/boss-contrast.json";
import { HOMEPAGE_BOSS_RENDERS } from "@/lib/homepage-boss-renders";

/**
 * The homepage subject has to be visible.
 *
 * Measured 2026-08-08: nine of the twelve curated renders sat under 3:1
 * against the #1C1811 ground, and Cerberus at 1.07:1 was the same luminance as
 * the page behind it — three days out of four the front page showed an empty
 * rectangle with a caption under it. Nothing caught it because the ground had
 * moved (Task 6) and nothing re-checked the art standing on it.
 */

const homepage = contrast.homepage as Record<string, { contrast: number; lostShare: number } | undefined>;

describe("every homepage boss render is accounted for", () => {
  it("measures every render the rotation can pick", () => {
    const unmeasured = HOMEPAGE_BOSS_RENDERS
      .filter((render) => !homepage[render.slug])
      .map((render) => render.slug);
    expect(
      unmeasured,
      `these renders have no contrast measurement — run scripts/measure-boss-contrast.mjs: ${unmeasured.join(", ")}`
    ).toEqual([]);
  });

  it("gives the lift to exactly the renders that cannot be seen without it", () => {
    const page = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    // The page decides per slug from the committed measurement...
    expect(page).toContain("data-boss-dark");
    expect(page).toContain("bossContrast.homepage");
    // ...and only that branch carries the brightness lift. A global lift would
    // wash out Zulrah and Corporeal Beast, which already read.
    const lifted = css.slice(css.indexOf('[data-boss-dark="true"] .boss-render'));
    expect(lifted).toContain("brightness(1.5)");
    const plain = css.slice(css.indexOf(".boss-render {"), css.indexOf('[data-boss-dark="true"]'));
    expect(plain, "the rim goes to every render").toContain("drop-shadow");
    expect(plain, "the lift must not be global").not.toContain("brightness(");
  });

  it("treats item sprites too — they had the same disease", () => {
    // Eleven of fifteen item sprites on /p/lauky measured under 3:1 against
    // their slot, one at 1.01:1 — the same luminance as the box it sat in.
    // The boss treatment shipped for the homepage only, so the player page
    // stayed full of dark rectangles: the dashboard feeling in its most
    // literal form.
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const rule = css.slice(css.indexOf(".journal-sprite-slot img,"));
    expect(rule.slice(0, 300)).toContain("drop-shadow");
    expect(rule.slice(0, 300)).toContain("brightness(1.4)");
    // 1.4, not 1.7: at 1.7 one sprite blew out 10.9% of its pixels.
    expect(rule.slice(0, 300)).not.toContain("brightness(1.7)");

    // An inline style beats any rule in this file. Both sprite call sites
    // passed filter:"none" inline, which is why the treatment could not reach
    // them until the overrides came out.
    for (const file of ["src/components/journal-primitives.tsx", "src/components/pinned-goals-panel.tsx"]) {
      expect(
        readFileSync(join(process.cwd(), file), "utf8"),
        `${file} pins filter inline and wins over the stylesheet`
      ).not.toContain('filter: "none"');
    }
  });

  it("keeps the plate dark, because lightening it measured backwards", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const plate = css.slice(css.indexOf(".boss-plate {"), css.indexOf(".boss-plate {") + 400);
    // Lifting the ground under the subject raises the background as much as the
    // silhouette: Phantom Muspah went 2.85:1 down to 2.36:1 with a light plate.
    expect(plate).toContain("rgba(28, 24, 17");
    expect(plate).not.toMatch(/rgba\((?:5[0-9]|[6-9][0-9]|1[0-9]{2}),/);
  });
});
