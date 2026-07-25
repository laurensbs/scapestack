import { describe, expect, it } from "vitest";
import { computeNextUp } from "@/lib/next-up";
import { detectAccountStage } from "@/lib/account-stage";
import { getDiaries } from "@/lib/diary-db";
import { getQuests } from "@/lib/quest-db";
import { evaluateDiaryTier } from "@/lib/diary-requirements";
import type { HiscoreSkill } from "@/lib/hiscores";

const SKILL_NAMES = [
  "Attack", "Defence", "Strength", "Hitpoints", "Ranged", "Prayer", "Magic",
  "Cooking", "Woodcutting", "Fletching", "Fishing", "Firemaking", "Crafting",
  "Smithing", "Mining", "Herblore", "Agility", "Thieving", "Slayer", "Farming",
  "Runecraft", "Hunter", "Construction"
];

function skillsAt(level: number): HiscoreSkill[] {
  return SKILL_NAMES.map((name, id) => ({
    id, name, level, xp: level >= 99 ? 13_034_431 : 737_627, rank: 1
  }));
}

describe("unknown quest points are not treated as zero", () => {
  // The OSRS Hiscores have no "Quest points" activity, so questPoints is null
  // for every RSN-only account. The old `?? 0` fallback made a 2277 account
  // read "183 quests likely open" at 0% and pinned it to the new-account stage.

  it("does not report a maxed account as having done no quests", async () => {
    const result = await computeNextUp({ skills: skillsAt(99) });
    const quests = result.pathProgress.paths.find((path) => path.kind === "quests");

    expect(quests).toBeTruthy();
    expect(quests!.percent).toBeGreaterThan(80);
    expect(quests!.tagline).not.toContain("183");
  });

  it("does not force an account into the new-account stage on unknown QP alone", () => {
    const stage = detectAccountStage({
      skills: skillsAt(85),
      combatLevel: 100,
      totalLevel: 1_955,
      questPoints: null,
      bossKc: {},
      hasBankContext: false,
      hasPluginSync: false
    });
    expect(stage.id).not.toBe("new-account");
  });

  it("still respects a real quest-point total when one is supplied", () => {
    const stage = detectAccountStage({
      skills: skillsAt(60),
      combatLevel: 70,
      totalLevel: 900,
      questPoints: 12,
      bossKc: {},
      hasBankContext: false,
      hasPluginSync: false
    });
    expect(stage.id).toBe("new-account");
  });
});

describe("dry-streak cards link to the kill check", () => {
  it("never points a boss KC card at a quest page", async () => {
    const result = await computeNextUp({
      skills: skillsAt(99),
      bossKc: { Vorkath: 900, "Chambers of Xeric": 400 }
    });
    const kcRecs = [result.headline, ...result.rest]
      .filter(Boolean)
      .filter((rec) => rec!.kind === "kc");

    expect(kcRecs.length).toBeGreaterThan(0);
    for (const rec of kcRecs) {
      // Regression: every one of these used to link to /quests/sheep-shearer,
      // a five-minute F2P starter quest, under a "900 Vorkath KC" headline.
      expect(rec!.link, rec!.title).not.toMatch(/^\/quests\//);
      expect(rec!.link, rec!.title).toMatch(/^\/dps/);
    }
  });
});

describe("diary quest gates come from the task data, not a hand-kept list", () => {
  it("enforces the quest a tier's own tasks name", async () => {
    const [diaries, quests] = await Promise.all([getDiaries(), getQuests()]);
    const western = [...diaries.entries()].find(([region]) => /Western/i.test(region));
    expect(western, "Western Provinces diary should exist").toBeTruthy();

    const [region, record] = western!;
    const evaluation = evaluateDiaryTier(region, "Hard", record, {
      completedQuests: [],
      knownQuestNames: quests.keys()
    });

    expect(evaluation.questRequirements.map((req) => req.name)).toContain("Regicide");
    expect(evaluation.questRequirements.every((req) => !req.met)).toBe(true);
  });

  it("covers far more tiers than the seven hand-written overrides", async () => {
    const [diaries, quests] = await Promise.all([getDiaries(), getQuests()]);
    let gated = 0;
    for (const [region, record] of diaries) {
      for (const tier of ["Easy", "Medium", "Hard", "Elite"] as const) {
        const evaluation = evaluateDiaryTier(region, tier, record, {
          completedQuests: [],
          knownQuestNames: quests.keys()
        });
        if (evaluation.questRequirements.length > 0) gated += 1;
      }
    }
    expect(gated).toBeGreaterThanOrEqual(30);
  });

  it("only enforces quests it can resolve, so a Wiki string never blocks forever", async () => {
    const [diaries, quests] = await Promise.all([getDiaries(), getQuests()]);
    const known = new Set([...quests.keys()].map((name) =>
      name.toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9]+/g, " ")
        .replace(/\b(?:a|an|the)\b/g, " ").replace(/\s+/g, " ").trim()));

    for (const [region, record] of diaries) {
      for (const tier of ["Easy", "Medium", "Hard", "Elite"] as const) {
        const evaluation = evaluateDiaryTier(region, tier, record, {
          completedQuests: [],
          knownQuestNames: quests.keys()
        });
        for (const req of evaluation.questRequirements) {
          const cleaned = req.name.toLowerCase().replace(/\([^)]*\)/g, "")
            .replace(/[^a-z0-9]+/g, " ").replace(/\b(?:a|an|the)\b/g, " ")
            .replace(/\s+/g, " ").trim();
          expect(known.has(cleaned), `${region} ${tier}: "${req.name}" is unresolvable`).toBe(true);
        }
      }
    }
  });

  it("skips derived gates entirely when no quest database is supplied", async () => {
    const diaries = await getDiaries();
    const [region, record] = [...diaries.entries()][0];
    const evaluation = evaluateDiaryTier(region, "Elite", record, { completedQuests: [] });
    expect(evaluation.questRequirements.length).toBe(0);
  });
});

describe("minigames respect quest gates", () => {
  it("does not offer quest-locked minigames to a questless account", async () => {
    const result = await computeNextUp({
      skills: skillsAt(60),
      scapestackSync: {
        displayName: "Questless",
        accountType: "normal",
        questsCompleted: [],
        diariesCompleted: [],
        collectionLogItemIds: []
      }
    });
    const titles = [result.headline, ...result.rest].filter(Boolean).map((rec) => rec!.title);

    for (const locked of ["Guardians of the Rift", "Pyramid Plunder", "Volcanic Mine", "Hallowed Sepulchre"]) {
      expect(titles.some((title) => title.includes(locked)), locked).toBe(false);
    }
  });

  it("still offers the level-only minigames", async () => {
    const result = await computeNextUp({
      skills: skillsAt(55),
      scapestackSync: {
        displayName: "Questless",
        accountType: "normal",
        questsCompleted: [],
        diariesCompleted: [],
        collectionLogItemIds: []
      }
    });
    const titles = [result.headline, ...result.rest].filter(Boolean).map((rec) => rec!.title);
    expect(titles.some((title) => /Wintertodt|Tempoross|Motherlode|Mahogany Homes|Soul Wars|Barbarian Assault/.test(title))).toBe(true);
  });
});
