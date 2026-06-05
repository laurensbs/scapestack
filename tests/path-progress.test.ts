import { describe, expect, it } from "vitest";
import { computePathProgress } from "@/lib/path-progress";
import type { HiscoreSkill } from "@/lib/hiscores";

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
});
