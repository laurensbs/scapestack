import { describe, it, expect } from "vitest";

// BOSS_CL_GATE and BOSS_GEAR_GATES live next to each other in next-up.ts —
// keeping them in sync is the only way a player gets gear-aware filtering.
// If a boss enters CL_GATE without a matching gear-gate entry we'd
// regress to the pre-audit behaviour ("Try Kraken to a player with no
// trident"). These tests catch that on the first failing CI run.
//
// We parse the source directly rather than importing — the constants are
// module-private. That's a smell for tests, but cheap and the alternative
// (export them just for tests) muddies the public surface.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(process.cwd(), "src/lib/next-up.ts"), "utf8");

function extractSlugs(constName: string): Set<string> {
  // Grab everything between "const NAME ... = {" and the matching closing "};"
  // — simple but works for our two flat object literals.
  const re = new RegExp(`const ${constName}[^=]*=\\s*{([\\s\\S]+?)\\n};`);
  const match = SRC.match(re);
  if (!match) throw new Error(`Could not find ${constName} in next-up.ts`);
  const slugs = new Set<string>();
  for (const m of match[1].matchAll(/"([a-z][a-z0-9-]+)":/g)) {
    slugs.add(m[1]);
  }
  return slugs;
}

describe("boss gate coverage", () => {
  const clGate = extractSlugs("BOSS_CL_GATE");
  const gearGate = extractSlugs("BOSS_GEAR_GATES");

  it("every boss in BOSS_CL_GATE has a BOSS_GEAR_GATES entry", () => {
    const missing: string[] = [];
    for (const slug of clGate) {
      if (!gearGate.has(slug)) missing.push(slug);
    }
    expect(missing, `Missing gear gates for: ${missing.join(", ")}`).toEqual([]);
  });

  it("no BOSS_GEAR_GATES entry refers to a boss that isn't gated by CL", () => {
    // Catches the inverse drift — a gear gate for a slug that boss-recs
    // would never reach. Not strictly broken, but it means the gate is
    // dead code and should be deleted.
    const orphans: string[] = [];
    for (const slug of gearGate) {
      if (!clGate.has(slug)) orphans.push(slug);
    }
    expect(orphans, `Orphan gear gates: ${orphans.join(", ")}`).toEqual([]);
  });
});
