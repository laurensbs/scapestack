import { describe, expect, it } from "vitest";
import { detectAccountStage } from "@/lib/account-stage";
import type { HiscoreSkill } from "@/lib/hiscores";

const SKILLS = [
  "Attack", "Defence", "Strength", "Hitpoints", "Ranged", "Prayer",
  "Magic", "Cooking", "Woodcutting", "Fletching", "Fishing", "Firemaking",
  "Crafting", "Smithing", "Mining", "Herblore", "Agility", "Thieving",
  "Slayer", "Farming", "Runecraft", "Hunter", "Construction", "Sailing"
];

function skillsFromLevels(levels: Partial<Record<string, number>>): HiscoreSkill[] {
  const skills = SKILLS.map((name, index) => ({
    id: index + 1,
    name,
    rank: 1,
    level: levels[name] ?? 1,
    xp: 737_627
  }));
  const totalLevel = skills.reduce((sum, skill) => sum + skill.level, 0);
  return [{ id: 0, name: "Overall", rank: 1, level: totalLevel, xp: 0 }, ...skills];
}

function stage(overrides: Partial<Parameters<typeof detectAccountStage>[0]> = {}) {
  return detectAccountStage({
    skills: [],
    combatLevel: null,
    totalLevel: null,
    questPoints: 0,
    bossKc: {},
    accountMeta: null,
    hasBankContext: false,
    hasPluginSync: false,
    ...overrides
  });
}

describe("account stage", () => {
  it("keeps first-run and gear-first accounts simple", () => {
    expect(stage().label).toBe("First run");
    expect(stage({ hasBankContext: true }).label).toBe("Gear-first");
  });

  it("recognises low-progress accounts without calling them dashboards", () => {
    expect(stage({
      skills: skillsFromLevels({ Attack: 30, Strength: 35, Defence: 30, Hitpoints: 35 }),
      combatLevel: 40,
      totalLevel: 420,
      questPoints: 12
    }).label).toBe("New account");
  });

  it("recognises skillers from low combat plus high non-combat levels", () => {
    expect(stage({
      skills: skillsFromLevels({
        Attack: 1, Strength: 1, Defence: 1, Hitpoints: 10, Ranged: 1, Prayer: 1, Magic: 1,
        Cooking: 80, Woodcutting: 80, Fishing: 80, Firemaking: 80, Crafting: 75, Mining: 75,
        Herblore: 70, Agility: 70, Thieving: 75, Farming: 80, Hunter: 75, Construction: 70
      }),
      combatLevel: 24,
      totalLevel: 1100,
      questPoints: 65
    }).label).toBe("Skiller");
  });

  it("recognises PvM-ready accounts from combat and boss history", () => {
    expect(stage({
      skills: skillsFromLevels({
        Attack: 90, Strength: 90, Defence: 85, Hitpoints: 90, Ranged: 90, Prayer: 74, Magic: 90,
        Slayer: 85
      }),
      combatLevel: 115,
      totalLevel: 1700,
      questPoints: 180,
      bossKc: { Vorkath: 48, Zulrah: 12 }
    }).label).toBe("PvM-ready");
  });

  it("recognises account types and late-game grinders", () => {
    expect(stage({
      skills: skillsFromLevels({ Attack: 80, Strength: 80, Defence: 80, Hitpoints: 80 }),
      combatLevel: 100,
      totalLevel: 1600,
      questPoints: 180,
      accountMeta: {
        displayName: "Iron Test",
        accountType: "ironman",
        ehp: 500,
        ehb: 20,
        lastChangedAt: null
      }
    }).label).toBe("Iron route");

    expect(stage({
      skills: skillsFromLevels(Object.fromEntries(SKILLS.map((name) => [name, 92])) as Partial<Record<string, number>>),
      combatLevel: 126,
      totalLevel: 2208,
      questPoints: 310,
      bossKc: { Vorkath: 900, Zulrah: 700 }
    }).label).toBe("Maxed grinder");
  });

  it("lets live RuneLite become quiet context for the session", () => {
    expect(stage({
      skills: skillsFromLevels({ Attack: 80, Strength: 80, Defence: 80, Hitpoints: 80 }),
      combatLevel: 100,
      totalLevel: 1600,
      questPoints: 180,
      hasPluginSync: true
    }).label).toBe("RuneLite-aware");
  });
});
