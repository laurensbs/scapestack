import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bossKnowledge, bossKnowledgeSupportsSingleDps } from "@/lib/boss-knowledge";
import { combatStatsFromSkills } from "@/lib/dps";
import { boundaryRows, specimenRows } from "@/components/home-specimen";
import { REFERENCE_BANK, REFERENCE_LEVELS, referenceSkills } from "@/lib/reference-account";

/**
 * The homepage shows a table of real numbers before the player types anything.
 * That is direction B's whole argument — the data is the design — and it only
 * holds while every number is the real engine answering about a real account.
 *
 * These guard the two ways it could quietly stop being true.
 */

const stats = combatStatsFromSkills(referenceSkills())!;

// The component's OWN selection, not a copy of it. The first version of this
// file re-implemented the filtering and then asserted against its own copy, so
// deleting the filter from the component left every test green — the third
// vacuous guard this repo has shipped. Exercise the real function.
const scored = specimenRows();

/** What the page actually renders. */
const shown = boundaryRows(scored);

describe("the reference account stays worth demonstrating with", () => {
  it("is not best-in-slot, so the table is not the same row five times", () => {
    // At BiS the engine picks Tumeken's shadow for all 59 bosses and every row
    // comes out identical — measured. A specimen that teaches nothing is worse
    // than no specimen.
    const weapons = new Set(scored.map((row) => row.weaponName));
    expect(weapons.size, `only ${[...weapons].join(", ")}`).toBeGreaterThan(1);
  });

  it("shows more than one setup ON THE PAGE, not merely in the pool", () => {
    // This assertion is the one that was missing. Correcting the boss stats
    // against the wiki moved the best answer to one weapon for every rendered
    // row, and the homepage shipped five identical setups while the test above
    // stayed green because the 32-row pool still held two weapons. The pool is
    // not what anybody sees.
    const shownWeapons = new Set(shown.map((row) => row.weaponName));
    expect(shownWeapons.size, `only ${[...shownWeapons].join(", ")}`).toBeGreaterThan(1);
  });

  it("produces a real spread of verdicts, not one flat answer", () => {
    const tones = new Set(scored.map((row) => row.tone));
    expect(tones.size).toBeGreaterThan(1);
    // And both sides of the boundary the specimen shows must exist.
    expect(scored.some((row) => row.tone === "ready")).toBe(true);
    expect(scored.some((row) => row.tone === "test")).toBe(true);
    // And the rendered rows must span more than one step of the ramp, or the
    // verdict column is a single colour and demonstrates nothing.
    expect(new Set(shown.map((row) => row.tone)).size).toBeGreaterThan(1);
  });

  it("keeps the levels and the bank consistent with each other", () => {
    // A 92-Ranged account with no ranged weapon gives advice that reads as
    // broken rather than as restrained.
    expect(REFERENCE_LEVELS.Ranged).toBeGreaterThan(80);
    expect(REFERENCE_BANK.some((item) => /blowpipe|bow|crossbow/i.test(item.name))).toBe(true);
    expect(REFERENCE_BANK.some((item) => /whip|scimitar|godsword|sword|maul/i.test(item.name))).toBe(true);
  });
});

describe("the specimen never overclaims", () => {
  const source = readFileSync(join(process.cwd(), "src/components/home-specimen.tsx"), "utf8");

  it("only shows encounters the engine will answer with one number", () => {
    // Regression: sorting by slowest-winnable pulled raids to the top and the
    // homepage printed "Theatre of Blood — Abyssal whip — 15m — Can kill". A
    // raid is rooms, roles and a team; one kill time says nothing true about
    // it. The engine already carries that judgement in bossKnowledge.dpsModel.
    for (const row of scored) {
      expect(bossKnowledgeSupportsSingleDps(bossKnowledge(row.boss)), row.boss.name).toBe(true);
      expect(row.boss.hp, row.boss.name).toBeGreaterThan(0);
    }
    // The specific encounters that used to leak through, checked against what
    // the page renders as well as against the pool it picks from.
    const slugs = new Set([...scored, ...shown].map((row) => row.boss.slug));
    for (const raid of ["tob", "cox", "toa", "fortis-colosseum", "tzkal-zuk", "tztok-jad"]) {
      expect([...slugs], raid).not.toContain(raid);
    }
  });

  it("computes from the engine rather than from a hand-written table", () => {
    // The one thing that would kill the direction: a fabricated specimen on
    // the page arguing that the data is real.
    expect(source).toContain("bossViabilityFromSimpleBank");
    expect(source).toContain("combatStatsFromSkills");
    expect(source).not.toMatch(/"\d+(?:\.\d+)?\s*(?:dps|DPS)"/);
  });

  it("names the account so nobody reads it as their own", () => {
    expect(source).toContain("REFERENCE_ACCOUNT_LABEL");
  });

  it("lets the word carry the verdict, with colour as the second signal", () => {
    expect(source).toContain('className="scape-verdict" data-gate={row.tone}');
    expect(source).toContain("{row.verdict}");
  });
});
