import { describe, expect, it } from "vitest";
import { computePathProgress } from "@/lib/path-progress";
import type { HiscoreSkill } from "@/lib/hiscores";
import type { QuestRecord } from "@/lib/quest-db";
import type { DiaryRecord } from "@/lib/diary-db";

const SKILL_NAMES = [
  "Overall", "Attack", "Defence", "Strength", "Hitpoints", "Ranged",
  "Prayer", "Magic", "Cooking", "Woodcutting", "Fletching", "Fishing",
  "Firemaking", "Crafting", "Smithing", "Mining", "Herblore", "Agility",
  "Thieving", "Slayer", "Farming", "Runecraft", "Hunter", "Construction", "Sailing"
];

function xpAtLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let levelIndex = 1; levelIndex < level; levelIndex++) {
    total += Math.floor(levelIndex + 300 * Math.pow(2, levelIndex / 7));
  }
  return Math.floor(total / 4);
}

function buildSkills(levels: Partial<Record<string, number>>): HiscoreSkill[] {
  const skills = SKILL_NAMES.map((name, id) => {
    const level = levels[name] ?? (name === "Hitpoints" ? 10 : 1);
    return { id, name, rank: 100_000, level, xp: xpAtLevel(level) };
  });
  const overallLevel = skills
    .filter((skill) => skill.name !== "Overall")
    .reduce((sum, skill) => sum + skill.level, 0);
  const overallXp = skills
    .filter((skill) => skill.name !== "Overall")
    .reduce((sum, skill) => sum + skill.xp, 0);
  skills[0] = { id: 0, name: "Overall", rank: 100_000, level: overallLevel, xp: overallXp };
  return skills;
}

function quest(name: string, questReqs: string[] = [], skillReqs: QuestRecord["skillReqs"] = []): QuestRecord {
  return {
    name,
    difficulty: "Experienced",
    length: "Medium",
    qpReq: 0,
    skillReqs,
    questReqs,
    itemReqs: [],
    ironmanNotes: []
  };
}

function routeById(overview: ReturnType<typeof computePathProgress>, id: string) {
  const route = overview.unlockRoutes.find((candidate) => candidate.id === id);
  expect(route).toBeTruthy();
  return route!;
}

describe("path progress", () => {
  it("scores broad mid-game skill investment without overstating it as near-max", () => {
    const overview = computePathProgress({
      skills: buildSkills({
        Attack: 90, Strength: 90, Defence: 80, Hitpoints: 85, Ranged: 92,
        Magic: 85, Prayer: 74, Slayer: 80,
        Cooking: 80, Woodcutting: 70, Fletching: 80, Fishing: 70,
        Firemaking: 70, Crafting: 75, Smithing: 70, Mining: 72,
        Herblore: 78, Agility: 70, Thieving: 80, Farming: 75,
        Runecraft: 70, Hunter: 70, Construction: 75
      }),
      quests: new Map(),
      diaries: new Map(),
      questPoints: 180,
      bossKc: {}
    });

    const skillsPath = overview.paths.find((path) => path.kind === "skills");
    expect(skillsPath?.percent).toBeGreaterThanOrEqual(30);
    expect(skillsPath?.percent).toBeLessThanOrEqual(40);
  });

  it("uses non-combat investment for level-3 skiller skill progress", () => {
    const overview = computePathProgress({
      skills: buildSkills({
        Attack: 1, Strength: 1, Defence: 1, Hitpoints: 10, Ranged: 1,
        Magic: 1, Prayer: 1, Slayer: 1,
        Cooking: 90, Woodcutting: 99, Fletching: 90, Fishing: 90,
        Firemaking: 99, Crafting: 85, Smithing: 80, Mining: 90,
        Herblore: 80, Agility: 80, Thieving: 80, Farming: 85,
        Runecraft: 80, Hunter: 80, Construction: 80
      }),
      quests: new Map(),
      diaries: new Map(),
      questPoints: 60,
      bossKc: {}
    });

    const skillsPath = overview.paths.find((path) => path.kind === "skills");
    expect(skillsPath?.percent).toBeGreaterThanOrEqual(45);
    expect(skillsPath?.percent).toBeLessThanOrEqual(55);
    expect(skillsPath?.tagline).toContain("skiller-weighted");
  });

  it("keeps all-70 main accounts far below max-cape parity", () => {
    const overview = computePathProgress({
      skills: buildSkills(Object.fromEntries(SKILL_NAMES.map((name) => [name, 70]))),
      quests: new Map(),
      diaries: new Map(),
      questPoints: 100,
      bossKc: {}
    });

    const skillsPath = overview.paths.find((path) => path.kind === "skills");
    expect(skillsPath?.percent).toBeLessThan(40);
  });

  it("plans Barrows gloves from the RFD prerequisite blocker", () => {
    const overview = computePathProgress({
      skills: buildSkills({ Cooking: 70, Agility: 48, Herblore: 25, Magic: 59 }),
      quests: new Map([
        ["Recipe for Disaster", quest("Recipe for Disaster", ["Desert Treasure"])],
        ["Desert Treasure", quest("Desert Treasure")]
      ]),
      diaries: new Map(),
      questPoints: 0,
      bossKc: {}
    });

    const route = routeById(overview, "barrows-gloves");
    expect(route.title).toBe("Barrows gloves");
    expect(route.nextAction).toContain("Desert Treasure");
    expect(route.blockers.map((blocker) => blocker.label)).toContain("Recipe for Disaster");
  });

  it("plans Fairy rings from Priest in Peril and Fairytale blockers", () => {
    const overview = computePathProgress({
      skills: buildSkills({}),
      quests: new Map([
        ["Priest in Peril", quest("Priest in Peril")],
        ["Fairytale I - Growing Pains", quest("Fairytale I - Growing Pains", ["Priest in Peril"])],
        ["Fairytale II - Cure a Queen", quest("Fairytale II - Cure a Queen", ["Fairytale I - Growing Pains"])]
      ]),
      diaries: new Map(),
      questPoints: 0,
      bossKc: {}
    });

    const route = routeById(overview, "fairy-rings");
    const blockers = route.blockers.map((blocker) => blocker.label);
    expect(blockers).toContain("Priest in Peril");
    expect(blockers).toContain("Fairytale I - Growing Pains");
    expect(blockers).toContain("Fairytale II - Cure a Queen");
    expect(route.payoff).toContain("Fast travel");
  });

  it("plans Piety from King's Ransom, Prayer and Knight Waves blockers", () => {
    const overview = computePathProgress({
      skills: buildSkills({ Defence: 65, Prayer: 60 }),
      quests: new Map([["King's Ransom", quest("King's Ransom")]]),
      diaries: new Map(),
      questPoints: 0,
      bossKc: {}
    });

    const route = routeById(overview, "piety");
    const blockerText = route.blockers.map((blocker) => `${blocker.label} ${blocker.nextAction}`).join(" ");
    expect(blockerText).toContain("King's Ransom");
    expect(blockerText).toContain("Prayer");
    expect(blockerText).toContain("Knight Waves");
  });

  it("plans diary unlocks from the closest diary tier blocker", () => {
    const ardougne: DiaryRecord = {
      name: "Ardougne",
      tiers: {
        Easy: { skills: [{ skill: "Thieving", level: 5 }] },
        Medium: { skills: [{ skill: "Fishing", level: 46 }] },
        Hard: { skills: [{ skill: "Thieving", level: 72 }] },
        Elite: { skills: [{ skill: "Magic", level: 94 }] }
      }
    };
    const overview = computePathProgress({
      skills: buildSkills({ Thieving: 70, Fishing: 43, Magic: 70 }),
      quests: new Map([["Biohazard", quest("Biohazard")]]),
      diaries: new Map([["Ardougne", ardougne]]),
      questPoints: 0,
      bossKc: {},
      scapestackSync: {
        questsCompleted: new Set(),
        diariesCompleted: new Set(["Ardougne:Easy"]),
        collectionLogItemIds: new Set()
      }
    });

    const route = routeById(overview, "diary-unlocks");
    expect(route.why).toContain("Ardougne Medium");
    expect(route.blockers.map((blocker) => blocker.label).join(" ")).toMatch(/Fishing|Biohazard|Plank|Mith grapple/);
  });

  it("uses UIM staging copy for route item prep", () => {
    const overview = computePathProgress({
      skills: buildSkills({ Ranged: 80 }),
      quests: new Map([
        ["Animal Magnetism", quest("Animal Magnetism")],
        ["Dragon Slayer II", quest("Dragon Slayer II")]
      ]),
      diaries: new Map(),
      questPoints: 0,
      bossKc: {},
      accountMeta: {
        displayName: "Uim Route",
        accountType: "ultimate",
        ehp: 0,
        ehb: 0,
        lastChangedAt: null
      },
      scapestackSync: {
        questsCompleted: new Set(["animal magnetism", "dragon slayer ii"]),
        diariesCompleted: new Set(),
        collectionLogItemIds: new Set()
      }
    });

    const route = routeById(overview, "avas-assembler");
    expect(route.nextAction).toContain("Stage/carry");
    expect(route.accountTypeNote).toContain("UIM");
  });
});
