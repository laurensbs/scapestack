import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sourceFiles = [
  "src/components/bank-result.tsx",
  "src/app/slayer/slayer-client.tsx",
  "src/app/next/next-client.tsx",
  "src/app/dps/dps-client.tsx",
  "src/app/plugin/page.tsx",
  "src/components/bank-plugin-onboarding.tsx",
  "src/components/plugin-sync-checker.tsx",
  "src/components/header.tsx",
  "src/components/tips-card.tsx",
  "src/app/layout.tsx",
  "src/app/dev/layout/page.tsx"
] as const;

const componentSources = sourceFiles.map((path) => ({
  path,
  source: readFileSync(join(process.cwd(), path), "utf8")
}));

const globalsCss = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function definedThemeTokens(prefix: string) {
  return new Set(
    [...globalsCss.matchAll(new RegExp(`(${prefix}[a-zA-Z0-9-]+)\\s*:`, "g"))]
      .map((match) => match[1])
  );
}

function usedVarTokens(prefix: string) {
  const tokens = new Set<string>();
  for (const { source } of componentSources) {
    for (const match of source.matchAll(new RegExp(`var\\((${prefix}[a-zA-Z0-9-]+)`, "g"))) {
      tokens.add(match[1]);
    }
  }
  return tokens;
}

describe("theme token regressions", () => {
  it("does not reference the old undefined warning token", () => {
    for (const { path, source } of componentSources) {
      expect(source, `${path} should use --color-warning`).not.toContain("var(--color-warn)");
    }
  });

  it("keeps the canonical warning token on the accent", () => {
    expect(globalsCss).toContain("--color-warning: #C4C1B8;");
    expect(globalsCss).not.toContain("--color-warn:");
  });

  it("keeps the visual system on the sourced palette instead of generic SaaS branding", () => {
    // The original of this test pinned #030201 / #E0AE37. That palette was
    // replaced deliberately on 2026-07-26 (direction B, see
    // docs/design/SCAPESTACK-DESIGN-SYSTEM.md): the old gold-on-black read as
    // generic epic fantasy rather than as OSRS, and was darker than any
    // surface RuneLite itself uses.
    //
    // What this test was really guarding is unchanged and still guarded
    // below: no drift toward a green-success SaaS palette.
    expect(globalsCss).toContain("--color-bg: #1C1811;");
    expect(globalsCss).toContain("--color-panel: #2A2318;");
    expect(globalsCss).toContain("--color-text: #EDEBE6;");
    // rs-gold from the runescapecn registry (verified 2026-08-08): the accent
    // tier went from neutral grey to the game's gold in the Task 6 skin.
    expect(globalsCss).toContain("--color-accent: #C9A961;");
    expect(globalsCss).not.toContain("#00E29A");
    expect(globalsCss).not.toMatch(/--color-good:\s*#(?:10|16|22|34|59)/i);
  });

  it("uses the game's own colours for data, not invented ones", () => {
    // Sampled from the client and cross-checked against RuneLite's
    // JagexColors. Players read magnitude by colour with no legend — a green
    // number is millions — so these are vocabulary we inherit, not choices.
    expect(globalsCss).toContain("--color-data-head: #FF981F;");
    expect(globalsCss).toContain("--color-data-level: #FFFF00;");
    expect(globalsCss).toContain("--color-data-m: #00FF80;");
    expect(globalsCss).toContain("--color-data-item: #FF9040;");
  });

  it("carries the game's nine-step difficulty ramp rather than a traffic light", () => {
    // Scapestack's entire product answers "can I do this right now". OSRS
    // already ships that colour language, derived from combat-level
    // difference, ramping through hue at full saturation.
    for (const step of ["#FF0000", "#FF3000", "#FF7000", "#FFB000", "#FFFF00",
                        "#C0FF00", "#80FF00", "#40FF00", "#00FF00"]) {
      expect(globalsCss, `ramp step ${step}`).toContain(step);
    }
  });

  it("has no second typeface for headings", () => {
    // The display serif made every page read as editorial. Hierarchy is
    // weight and size now; --font-display remains as a seam so a future
    // decision has somewhere to land, but it resolves to the body stack.
    const sans = globalsCss.match(/--font-sans:\s*([^;]+);/);
    const display = globalsCss.match(/--font-display:\s*([^;]+);/);
    expect(sans, "--font-sans should still be declared").toBeTruthy();
    expect(display, "--font-display should still be declared").toBeTruthy();
    // Checked by naming the serif faces, not by matching /serif$/ — every
    // sans stack ends in "sans-serif" and would trip that.
    for (const face of ["Iowan Old Style", "Georgia", "Charter"]) {
      expect(display![1], face).not.toContain(face);
    }
    expect(display![1]).toBe(sans![1]);
    expect(display![1]).toContain("var(--font-archivo)");
  });

  it("defines the shared visual primitives for the reset", () => {
    expect(globalsCss).toContain(".scapestack-modal");
    expect(globalsCss).toContain(".scapestack-route-card");
    expect(globalsCss).toContain(".scapestack-boss-tile");
    expect(globalsCss).toContain(".scapestack-account-pill");
    expect(globalsCss).toContain(".scapestack-ghost-action");
  });

  it("defines every color token used by core UI surfaces", () => {
    const missing = [...usedVarTokens("--color-")]
      .filter((token) => !definedThemeTokens("--color-").has(token));

    expect(missing).toEqual([]);
  });

  it("defines every font token used by core UI surfaces", () => {
    const missing = [...usedVarTokens("--font-")]
      .filter((token) => !definedThemeTokens("--font-").has(token));

    expect(missing).toEqual([]);
  });
});
