import { describe, expect, it } from "vitest";
import { computeNextUp } from "@/lib/next-up";
import { pickForRoute } from "@/lib/mood";
import { BOSS_GEAR_GATES } from "@/lib/next-up-bosses";
import { MONSTERS_BY_ID } from "@/lib/slayer/monsters";
import type { HiscoreSkill } from "@/lib/hiscores";

const SKILL_NAMES = [
  "Attack", "Defence", "Strength", "Hitpoints", "Ranged", "Prayer", "Magic",
  "Cooking", "Woodcutting", "Fletching", "Fishing", "Firemaking", "Crafting",
  "Smithing", "Mining", "Herblore", "Agility", "Thieving", "Slayer", "Farming",
  "Runecraft", "Hunter", "Construction"
];

function skillsAt(level: number, overrides: Record<string, number> = {}): HiscoreSkill[] {
  return SKILL_NAMES.map((name, id) => ({
    id,
    name,
    level: overrides[name] ?? level,
    xp: 13_034_431,
    rank: 1
  }));
}

async function recTitles(input: Parameters<typeof computeNextUp>[0]): Promise<string[]> {
  const result = await computeNextUp(input);
  return [result.headline, ...result.rest].filter(Boolean).map((rec) => rec!.title);
}

describe("Slayer requirements match the repo's own monster data", () => {
  // The engine kept a second copy of the Slayer gates in BOSS_GEAR_GATES and
  // it drifted: Thermonuclear was gated at 70 while slayer/monsters.ts said
  // 93. A 23-level error on a Slayer boss is the most legible kind of wrong
  // to an OSRS player, so pin the two tables to each other.
  const PAIRS: Array<[gateSlug: string, monsterId: string]> = [
    ["thermonuclear", "thermonuclear"],
    ["cerberus", "cerberus"],
    ["hydra", "alchemical_hydra"],
    ["sire", "abyssal_sire"]
  ];

  for (const [slug, monsterId] of PAIRS) {
    it(`${slug} is gated at the level monsters.ts states`, () => {
      const monster = MONSTERS_BY_ID.get(monsterId);
      expect(monster?.slayerLevel, `monsters.ts is missing ${monsterId}`).toBeGreaterThan(0);
      expect(BOSS_GEAR_GATES[slug]?.slayerLevel).toBe(monster!.slayerLevel);
    });
  }
});

describe("Slayer gates apply without a bank", () => {
  it("does not offer a Slayer boss to an account below its Slayer level", async () => {
    // The gear half of BOSS_GEAR_GATES is unknowable without a bank and is
    // deliberately let through. The Slayer half is in the Hiscores, so it is
    // never an excuse — this used to be skipped entirely when bank was empty.
    const titles = await recTitles({ skills: skillsAt(99, { Slayer: 80 }), questPoints: 300 });
    for (const boss of ["Cerberus", "Alchemical Hydra", "Thermonuclear", "Araxxor", "Abyssal Sire"]) {
      expect(titles.some((title) => title.includes(boss)), `${boss} needs more Slayer than 80`).toBe(false);
    }
  });

  it("still offers them once the Slayer level is there", async () => {
    const titles = await recTitles({ skills: skillsAt(99), questPoints: 300 });
    expect(titles.some((title) => /Cerberus|Hydra|Araxxor|Thermonuclear/.test(title))).toBe(true);
  });
});

describe("the Bossing mood always resolves when boss recommendations exist", () => {
  // Regression: setupConfidence "unknown" was a hard eligibility violation, and
  // every boss generator reports "unknown" without a bank. The planner would
  // produce good boss trips and the Bossing tile would still say
  // "No safe trip fits this exact mood and time yet."
  for (const [label, input] of [
    ["maxed, hiscores only", { skills: skillsAt(99), questPoints: 300 }],
    ["mid-game, hiscores only", { skills: skillsAt(85), questPoints: 200 }]
  ] as const) {
    it(`picks a bossing trip for ${label}`, async () => {
      const result = await computeNextUp(input);
      const recs = [result.headline, ...result.rest].filter(Boolean) as NonNullable<typeof result.headline>[];
      const pvm = recs.filter((rec) => ["boss", "kc", "slayer"].includes(rec.kind));
      expect(pvm.length, "precondition: engine produced boss candidates").toBeGreaterThan(0);
      expect(pickForRoute(recs, "bossing", 120, "boss-log")).not.toBeNull();
    });
  }
});

describe("money method requirements", () => {
  it("offers Wines of Zamorak to the low-Magic accounts that need it", async () => {
    // Telekinetic Grab is 33 Magic. The catalogue said 66, which locked the
    // classic low-level cash method away from exactly its audience.
    const titles = await recTitles({ skills: skillsAt(40, { Magic: 35 }), questPoints: 20 });
    expect(titles.some((title) => title.includes("Wines of Zamorak"))).toBe(true);
  });
});
