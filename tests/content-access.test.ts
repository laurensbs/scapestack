import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeNextUp } from "@/lib/next-up";
import { evaluateAccess } from "@/lib/content-access";
import { allGateQuestNames, BOSS_ACCESS, MONEY_ACCESS } from "@/lib/content-access-data";
import type { HiscoreSkill } from "@/lib/hiscores";

const SKILL_NAMES = [
  "Attack", "Defence", "Strength", "Hitpoints", "Ranged", "Prayer", "Magic",
  "Cooking", "Woodcutting", "Fletching", "Fishing", "Firemaking", "Crafting",
  "Smithing", "Mining", "Herblore", "Agility", "Thieving", "Slayer", "Farming",
  "Runecraft", "Hunter", "Construction"
];

function skillsAt(level: number): HiscoreSkill[] {
  return SKILL_NAMES.map((name, id) => ({ id, name, level, xp: 13_034_431, rank: 1 }));
}

/** Content whose real gate is a quest we can prove. */
const QUEST_GATED = [
  "Wrath rune crafting",
  "Blood rune crafting",
  "Rune dragons",
  "Zulrah",
  "Vorkath",
  "Birdhouse run",
  "Tree run"
];

function titles(result: Awaited<ReturnType<typeof computeNextUp>>): string[] {
  return [result.headline, ...result.rest].filter(Boolean).map((rec) => rec!.title);
}

function mentionsQuestGatedContent(list: string[]): string[] {
  return list.filter((title) => QUEST_GATED.some((needle) => title.includes(needle)));
}

describe("content access gating", () => {
  it("stops recommending quest-locked content when RuneLite proves no quests are done", async () => {
    // The regression this whole model exists for: maxed stats, zero quests.
    // This account cannot reach Vorkath, Zulrah, the Wrath altar, the blood
    // altar, rune dragons or Fossil Island — and we can prove it.
    const result = await computeNextUp({
      skills: skillsAt(99),
      questPoints: 0,
      scapestackSync: {
        displayName: "QuestlessMax",
        accountType: "normal",
        questsCompleted: [],
        diariesCompleted: [],
        collectionLogItemIds: []
      }
    });

    expect(mentionsQuestGatedContent(titles(result))).toEqual([]);
  });

  it("allows the same content once the unlocking quests are reported complete", async () => {
    const result = await computeNextUp({
      skills: skillsAt(99),
      questPoints: 300,
      scapestackSync: {
        displayName: "QuestedMax",
        accountType: "normal",
        questsCompleted: [
          "Dragon Slayer II", "Regicide", "Sins of the Father",
          "Bone Voyage", "The Giant Dwarf", "Priest in Peril",
          "Troll Stronghold", "Monkey Madness II", "Secrets of the North",
          "Desert Treasure II - The Fallen Empire", "The Fremennik Trials"
        ],
        diariesCompleted: [],
        collectionLogItemIds: []
      }
    });

    expect(mentionsQuestGatedContent(titles(result)).length).toBeGreaterThan(0);
  });

  it("never silently hides content when there is no exact quest source", async () => {
    // No plugin sync — we do not know what is done, so suppressing would be
    // worse than the bug. Content stays, hedged.
    const result = await computeNextUp({ skills: skillsAt(99), questPoints: 300 });
    expect(mentionsQuestGatedContent(titles(result)).length).toBeGreaterThan(0);
  });

  it("states the unverified unlock on the card instead of assuming it", async () => {
    const result = await computeNextUp({ skills: skillsAt(99), questPoints: 300 });
    const gated = [result.headline, ...result.rest]
      .filter(Boolean)
      .filter((rec) => QUEST_GATED.some((needle) => rec!.title.includes(needle)));

    expect(gated.length).toBeGreaterThan(0);
    for (const rec of gated) {
      const needs = (rec!.needs ?? []).join(" ");
      expect(needs, rec!.title).toMatch(/Needs .*RuneLite sync/);
    }
  });
});

describe("content access evaluator", () => {
  const skills = skillsAt(99);

  it("reports locked only when an exact source proves the gap", () => {
    const requirement = { quests: ["Dragon Slayer II"] };
    expect(evaluateAccess(requirement, { skills, completedQuestNames: new Set() }).state).toBe("locked");
    expect(evaluateAccess(requirement, { skills, completedQuestNames: new Set(["dragon slayer ii"]) }).state).toBe("unlocked");
    expect(evaluateAccess(requirement, { skills }).state).toBe("unknown");
  });

  it("keeps favour unverifiable because the plugin never sends it", () => {
    const verdict = evaluateAccess(
      { favour: { house: "Hosidius", percent: 75 } },
      { skills, completedQuestNames: new Set(["everything"]) }
    );
    expect(verdict.state).toBe("unknown");
    expect(verdict.unverified).toEqual(["75% Hosidius favour"]);
  });

  it("treats a missing requirement as no requirement", () => {
    expect(evaluateAccess(undefined, { skills }).state).toBe("unlocked");
  });
});

describe("content access data", () => {
  it("only names quests that exist in the quest database", () => {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "data/quests.json"), "utf8")) as unknown;
    const quests = (Array.isArray(raw) ? raw : Object.values(raw as Record<string, unknown>)) as Array<{ name: string }>;
    const known = new Set(quests.map((quest) => quest.name));

    for (const name of allGateQuestNames()) {
      expect(known.has(name), `unknown gate quest: ${name}`).toBe(true);
    }
  });

  it("keeps every gate pointed at real content slugs", async () => {
    const { BOSSES } = await import("@/lib/bosses");
    const bossSlugs = new Set(BOSSES.map((boss) => boss.slug));
    for (const slug of Object.keys(BOSS_ACCESS)) {
      expect(bossSlugs.has(slug), `unknown boss slug: ${slug}`).toBe(true);
    }

    const moneySource = readFileSync(join(process.cwd(), "src/lib/next-up-money.ts"), "utf8");
    for (const slug of Object.keys(MONEY_ACCESS)) {
      expect(moneySource.includes(`slug: "${slug}"`), `unknown money slug: ${slug}`).toBe(true);
    }
  });
});
