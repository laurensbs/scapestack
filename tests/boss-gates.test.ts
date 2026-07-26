import { describe, it, expect } from "vitest";

// BOSS_CL_GATE and BOSS_GEAR_GATES both live in the /next engine — keeping
// them in sync is the only way a player gets gear-aware filtering.
// If a boss enters CL_GATE without a matching gear-gate entry we'd
// regress to the pre-audit behaviour ("Try Kraken to a player with no
// trident"). These tests catch that on the first failing CI run.
//
// We parse the source directly rather than importing — the constants are
// module-private. That's a smell for tests, but cheap and the alternative
// (export them just for tests) muddies the public surface.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BOSSES, isNonCombatBossActivity } from "@/lib/bosses";
import { BOSS_CL_GATE } from "@/lib/boss-gates";
import { BOSS_GEAR_GATES, matchedGearForBoss } from "@/lib/next-up-bosses";
import { nextUpSource } from "./helpers/next-up-source";

const SRC = nextUpSource();

function extractSlugs(constName: string): Set<string> {
  // Grab everything between "const NAME ... = {" and the matching closing "};"
  // — simple but works for our two flat object literals.
  const re = new RegExp(`const ${constName}[^=]*=\\s*{([\\s\\S]+?)\\n};`);
  const match = SRC.match(re);
  if (!match) throw new Error(`Could not find ${constName} in the /next engine sources`);
  const slugs = new Set<string>();
  for (const m of match[1].matchAll(/"([a-z][a-z0-9-]+)":/g)) {
    slugs.add(m[1]);
  }
  return slugs;
}

describe("boss gate coverage", () => {
  const clGate = new Set(Object.keys(BOSS_CL_GATE));
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

/**
 * Nothing here existed while half the roster was invisible.
 *
 * bossRecs does `if (gate === undefined) continue`, so a boss with no
 * BOSS_CL_GATE entry is not "ungated" — it is absent. Thirty of sixty bosses
 * were in that state, including Hespori, Amoxliatl and Moons of Peril, which
 * sit exactly in the band the reachable-boss fallback was written to serve and
 * which it could therefore never reach either. Two existing tests checked that
 * the gate tables agreed with each other; neither noticed that between them
 * they covered half the game.
 */
describe("every boss the roster shows is reachable by the engine", () => {
  /** Fought with a pickaxe, a bow of light or a tinderbox — not a combat gate. */
  const NON_COMBAT = new Set(["wintertodt", "tempoross", "guardians-of-the-rift", "zalcano"]);

  it("gates every combat boss in BOSSES", () => {
    const clGate = new Set(Object.keys(BOSS_CL_GATE));
    const missing = BOSSES
      .filter((boss) => !NON_COMBAT.has(boss.slug) && !isNonCombatBossActivity(boss))
      .map((boss) => boss.slug)
      .filter((slug) => !clGate.has(slug));
    expect(missing, `Bosses /next can never suggest: ${missing.join(", ")}`).toEqual([]);
  });

  it("keeps the allowlist honest — an entry there must really be non-combat", () => {
    // Otherwise the allowlist becomes the place bosses go to be forgotten.
    for (const slug of NON_COMBAT) {
      const boss = BOSSES.find((entry) => entry.slug === slug);
      expect(boss, slug).toBeTruthy();
      expect(isNonCombatBossActivity(boss!), `${slug} still looks like a fight`).toBe(true);
    }
  });

  it("lists no boss twice", () => {
    // "kbd" was a byte-identical second King Black Dragon — same stats, same
    // icon, same name — so /dps showed the boss twice and only one of the two
    // was ever gated.
    const names = BOSSES.map((boss) => boss.name.toLowerCase());
    expect(names.length, [...new Set(names)].filter((n) => names.filter((m) => m === n).length > 1).join(", "))
      .toBe(new Set(names).size);
    const slugs = BOSSES.map((boss) => boss.slug);
    expect(slugs.length).toBe(new Set(slugs).size);
  });

  it("keeps one table, not two", () => {
    // boss-roster.tsx used to carry its own COMBAT_GATE so the catalogue could
    // render without importing the engine. The two had drifted twenty-five
    // entries apart and nothing would have said so; both now read the same
    // module, and this stops a copy reappearing.
    const roster = readFileSync(join(process.cwd(), "src/components/boss-roster.tsx"), "utf8");
    expect(roster).toContain('from "@/lib/boss-gates"');
    expect(roster).not.toMatch(/const COMBAT_GATE[^=]*=\s*\{/);
  });
});

describe("a gear gate names items that exist", () => {
  it("matches every BOSS_GEAR_GATES needs entry against the real item list", () => {
    // matchedGearForBoss compares these strings against the player's bank, so a
    // typo does not error — it matches nothing, and the boss is then suppressed
    // for every account that pasted a bank. Silent, and indistinguishable from
    // the gate working.
    //
    // Imported directly, not parsed out of the source. The first version of
    // this test regexed for the table, anchored on a header comment that
    // mentions BOSS_GEAR_GATES, captured BOSS_GROUPS instead, and validated
    // exactly zero names — which is how "shadow of tumeken" (the item is
    // called Tumeken's shadow) survived it.
    const items: string[] = Object.values(
      JSON.parse(readFileSync(join(process.cwd(), "data/items.json"), "utf8")) as Record<string, string>
    ).map((name) => String(name).toLowerCase());

    const unknown: string[] = [];
    for (const [slug, gate] of Object.entries(BOSS_GEAR_GATES)) {
      if (!gate) continue;
      for (const need of gate.needs) {
        if (!items.some((name) => name.includes(need.toLowerCase()))) {
          unknown.push(`${slug}: "${need}"`);
        }
      }
    }
    expect(unknown, unknown.join(" | ")).toEqual([]);
  });

  it("lets an empty needs list through instead of blocking every bank", () => {
    // Amoxliatl shipped as { needs: [], slayerLevel: 48 } and the matcher read
    // the empty list as "no gear matches" — invisible for every account that
    // pasted a bank, visible for accounts that did not.
    expect(matchedGearForBoss("amoxliatl", [{ id: 4151, name: "Abyssal whip" }], 99)).toEqual({ item: "" });
    expect(matchedGearForBoss("amoxliatl", [{ id: 4151, name: "Abyssal whip" }], 40)).toBeNull();
  });

  it("enforces Hespori's Farming bar, which used to live only in a comment", () => {
    const gate = BOSS_GEAR_GATES["hespori"];
    expect(gate?.skillLevels?.Farming).toBe(65);
  });
});
