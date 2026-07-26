import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOSSES, bossHasAttribute } from "@/lib/bosses";

/**
 * The game's facts come from the wiki, not from this repo.
 *
 * Before the overlay, "Stats sourced from oldschool.runescape.wiki" was a
 * comment at the top of bosses.ts and 232 of the numbers underneath it
 * disagreed with the wiki — Callisto at 470 HP against 1000, Araxxor at 460
 * against 1020. A comment cannot be tested. A join can.
 */

const derived = JSON.parse(
  readFileSync(join(process.cwd(), "data/wiki/derived/boss-stats.json"), "utf8")
) as Record<string, { hp: number; defenceBonuses: Record<string, number>; attributes: string[] }>;

describe("boss numbers are the wiki's", () => {
  it("takes hitpoints and defence bonuses from the snapshot for every boss that has a row", () => {
    const wrong: string[] = [];
    for (const boss of BOSSES) {
      const row = derived[boss.slug];
      if (!row) continue;
      if (boss.hp !== row.hp) wrong.push(`${boss.slug} hp ${boss.hp} != ${row.hp}`);
      for (const style of ["stab", "slash", "crush", "magic", "ranged"] as const) {
        if (boss.defenceBonuses[style] !== row.defenceBonuses[style]) {
          wrong.push(`${boss.slug} def.${style} ${boss.defenceBonuses[style]} != ${row.defenceBonuses[style]}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it("marks the encounters the wiki does not describe, instead of pretending they are sourced", () => {
    // Raids, Barrows, Wintertodt and friends are multi-NPC fights that no
    // single monster infobox covers. Their numbers are our model. The point of
    // the flag is that a reader can tell which is which.
    const manual = BOSSES.filter((boss) => boss.factsSource === "manual").map((boss) => boss.slug);
    const sourced = BOSSES.filter((boss) => boss.factsSource === "wiki");
    expect(sourced.length).toBeGreaterThan(40);
    expect(manual.length).toBeGreaterThan(0);
    for (const slug of manual) expect(derived[slug]).toBeUndefined();
  });

  it("reads undead off the wiki instead of guessing from the name", () => {
    // The three the regex got wrong, which is the whole reason this exists:
    // dps.ts tested /vorkath|skotizo|barrows|zombi/i against boss.name, so the
    // Salve amulet went to a demon and was withheld from two undead bosses.
    const skotizo = BOSSES.find((boss) => boss.slug === "skotizo");
    const vetion = BOSSES.find((boss) => boss.slug === "vetion");
    const calvarion = BOSSES.find((boss) => boss.slug === "calvarion");
    const vorkath = BOSSES.find((boss) => boss.slug === "vorkath");
    expect(skotizo && bossHasAttribute(skotizo, "undead")).toBe(false);
    expect(skotizo && bossHasAttribute(skotizo, "demon")).toBe(true);
    expect(vetion && bossHasAttribute(vetion, "undead")).toBe(true);
    expect(calvarion && bossHasAttribute(calvarion, "undead")).toBe(true);
    expect(vorkath && bossHasAttribute(vorkath, "undead")).toBe(true);
  });

  it("picks the version a player actually fights, not the biggest number", () => {
    // The first version-picking rule was "most hitpoints", which selected
    // Awakened Vardorvis — 1400 HP, combat 1136, an optional superhard mode.
    // The wiki marks its own default and that is what the projection uses now.
    const vardorvis = BOSSES.find((boss) => boss.slug === "vardorvis");
    expect(vardorvis?.hp).toBe(700);
    // Vorkath the other way round: 460 during Dragon Slayer II, 750 after, and
    // the post-quest one is what anyone choosing a boss for tonight means.
    expect(BOSSES.find((boss) => boss.slug === "vorkath")?.hp).toBe(750);
    // And the ones the hand-typed table had badly wrong.
    expect(BOSSES.find((boss) => boss.slug === "araxxor")?.hp).toBe(1020);
    expect(BOSSES.find((boss) => boss.slug === "callisto")?.hp).toBe(1000);
    expect(BOSSES.find((boss) => boss.slug === "hueycoatl")?.hp).toBe(2500);
  });

  it("carries target size, so the Scythe stops multiplying against 1x1 targets", () => {
    const sized = BOSSES.filter((boss) => boss.factsSource === "wiki" && typeof boss.size === "number");
    expect(sized.length).toBeGreaterThan(40);
    expect(BOSSES.find((boss) => boss.slug === "vorkath")?.size).toBe(7);
  });
});
