import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FONTS, FORBIDDEN_FONTS, GOLD, MSG, PARCHMENT, RADIUS, STONE } from "@/app/design-tokens";

/**
 * REBRAND.md, enforced where a screenshot cannot reach.
 *
 * scripts/rebrand-lint.mjs greps for forbidden patterns and the Section 7 loop
 * catches what a page looks like. Neither can check that the tokens in code
 * still agree with the tokens in CSS, or that a contrast floor written down in
 * Section 10 is still true. Those go here.
 */

const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");

/** WCAG relative luminance, so the contrast claims are computed and not quoted. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe("the tokens in code and the tokens in CSS are the same tokens", () => {
  it("declares every design-tokens.ts value in globals.css", () => {
    // Two sources of truth for one palette is how a system drifts apart while
    // both halves look maintained.
    const expected: Array<[string, string]> = [
      ["--stone-900", STONE[900]],
      ["--stone-800", STONE[800]],
      ["--stone-700", STONE[700]],
      ["--parchment-100", PARCHMENT[100]],
      ["--ink-900", "#241a10"],
      ["--gold-500", GOLD[500]],
      ["--msg-good", MSG.good],
      ["--msg-warn", MSG.warn],
      ["--radius-md", RADIUS.md]
    ];
    // Whitespace-tolerant: Section 1's block is pasted verbatim, and it aligns
    // its values in columns. A test that pinned the column widths would fail
    // on a reformat and teach everyone to distrust it.
    for (const [name, value] of expected) {
      const declared = globals.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim();
      expect(declared, `${name} should be ${value}`).toBe(value);
    }
  });

  it("names the three faces and nothing else", () => {
    expect(FONTS.display).toContain("Cinzel");
    expect(FONTS.body).toContain("Fraunces");
    expect(FONTS.numeral).toContain("Pixelify Sans");
    expect(layout).toContain("Cinzel");
    expect(layout).toContain("Fraunces");
    expect(layout).toContain("Pixelify_Sans");
  });

  it("has removed every forbidden face from the shipped font stacks", () => {
    // Reads the resolved --font-sans / --font-display stacks rather than the
    // whole file: a forbidden name inside a comment explaining the ban is not
    // a use of it, and this check firing on its own documentation is how it
    // would end up deleted.
    const stacks = [...globals.matchAll(/--font-(?:sans|display|numeral|mono):\s*([^;]+);/g)].map((m) => m[1]);
    expect(stacks.length, "font stacks should be declared").toBeGreaterThan(0);
    for (const stack of stacks) {
      for (const face of FORBIDDEN_FONTS) {
        expect(stack, `${face} in "${stack}"`).not.toContain(face);
      }
    }
  });

  it("carries no recreation of a Jagex face", () => {
    // REBRAND.md 9.4. The three RuneStar .ttf files were deleted, not just
    // unreferenced — an unreferenced binary comes back the moment someone
    // greps for a font and finds one already committed.
    expect(() => readFileSync(join(process.cwd(), "src/fonts/RuneScape-Plain-12.ttf"))).toThrow();
    expect(() => readFileSync(join(process.cwd(), "src/fonts/RuneScape-Bold-12.ttf"))).toThrow();
    expect(() => readFileSync(join(process.cwd(), "src/fonts/RuneScape-Quill-Caps.ttf"))).toThrow();
  });
});

describe("the contrast floors REBRAND Section 10 recorded are still true", () => {
  it("keeps ink on parchment readable", () => {
    expect(contrast(PARCHMENT[100], "#241a10")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(PARCHMENT[100], "#7a6647")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps gold and green usable at any size on stone", () => {
    expect(contrast(STONE[800], GOLD[500])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(STONE[800], MSG.good)).toBeGreaterThanOrEqual(4.5);
  });

  it("records that red does NOT clear AA for normal text, which is why it has a size floor", () => {
    // Measured during Phase A: 3.95:1 on stone-800. The floor is the fix —
    // red status renders at 16px/600, where AA-large (3:1) applies. If a
    // future palette change makes red pass at any size, this assertion is the
    // one that should be revisited, so it asserts the fact rather than hiding
    // it in a comment.
    const onStone = contrast(STONE[800], MSG.warn);
    expect(onStone).toBeLessThan(4.5);
    expect(onStone).toBeGreaterThanOrEqual(3);
  });
});

describe("the components exist and speak the system", () => {
  const stone = readFileSync(join(process.cwd(), "src/components/rebrand/stone.tsx"), "utf8");

  it("builds depth from bevels, never from blur", () => {
    expect(stone).toContain("var(--bevel-light)");
    expect(stone).toContain("var(--bevel-dark)");
    // REBRAND F11. A blur radius in a box-shadow is the SaaS card's whole
    // signature; every offset here is hard.
    expect(stone).not.toMatch(/box-shadow[^"]*\d+px\s+\d+px\s+\d+px/);
  });

  it("renders sprites pixelated", () => {
    expect(stone).toContain('imageRendering: "pixelated"');
  });

  it("separates single quantities from ratios", () => {
    // REBRAND.md 10.2: Pixelify Sans renders 5 as S and 7 as a bare stem, so
    // "68/70" reads "68/10". Ratios must not reach that face.
    expect(stone).toContain("var(--font-numeral)");
    expect(stone).toContain('fontVariantNumeric: "tabular-nums lining-nums"');
  });
});
