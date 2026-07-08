import { describe, expect, it } from "vitest";
import { evaluateDiaryTier } from "@/lib/diary-requirements";
import type { DiaryRecord } from "@/lib/diary-db";
import type { HiscoreSkill } from "@/lib/hiscores";

const SKILLS = [
  "Attack", "Defence", "Strength", "Hitpoints", "Ranged", "Prayer",
  "Magic", "Cooking", "Woodcutting", "Fletching", "Fishing", "Firemaking",
  "Crafting", "Smithing", "Mining", "Herblore", "Agility", "Thieving",
  "Slayer", "Farming", "Runecraft", "Hunter", "Construction", "Sailing"
];

function skillsFromLevels(levels: Partial<Record<string, number>>, fallback = 70): HiscoreSkill[] {
  const skills = SKILLS.map((name, index) => ({
    id: index + 1,
    name,
    rank: 1,
    level: levels[name] ?? fallback,
    xp: 737_627
  }));
  const totalLevel = skills.reduce((sum, skill) => sum + skill.level, 0);
  return [{ id: 0, name: "Overall", rank: 1, level: totalLevel, xp: 0 }, ...skills];
}

const ardougneDiary: DiaryRecord = {
  name: "Ardougne",
  tiers: {
    Easy: { skills: [{ skill: "Thieving", level: 5 }] },
    Medium: {
      skills: [
        { skill: "Magic", level: 51 },
        { skill: "Firemaking", level: 50 },
        { skill: "Crafting", level: 49 },
        { skill: "Agility", level: 39 }
      ]
    },
    Hard: { skills: [{ skill: "Thieving", level: 72 }] },
    Elite: { skills: [{ skill: "Magic", level: 94 }] }
  }
};

const kandarinDiary: DiaryRecord = {
  name: "Kandarin",
  tiers: {
    Easy: { skills: [{ skill: "Agility", level: 20 }] },
    Medium: { skills: [{ skill: "Fishing", level: 46 }] },
    Hard: {
      skills: [
        { skill: "Smithing", level: 75 },
        { skill: "Agility", level: 60 }
      ]
    },
    Elite: { skills: [{ skill: "Smithing", level: 90 }] }
  }
};

describe("diary requirement matching", () => {
  it("marks a diary ready when skills, quests and bank items are present", () => {
    const result = evaluateDiaryTier("Ardougne", "Medium", ardougneDiary, {
      skills: skillsFromLevels({}),
      completedQuests: ["Biohazard"],
      bankItems: [
        { name: "Rope", quantity: 1 },
        { name: "Plank", quantity: 2 },
        { name: "Mith grapple", quantity: 1 }
      ]
    });

    expect(result.readinessStatus).toBe("ready");
    expect(result.bank.owned.map((req) => req.name)).toEqual(["Rope", "Plank", "Mith grapple"]);
    expect(result.missingRequirements).toEqual([]);
  });

  it("reports missing skill levels", () => {
    const result = evaluateDiaryTier("Kandarin", "Hard", kandarinDiary, {
      skills: skillsFromLevels({ Smithing: 75, Agility: 55 })
    });

    expect(result.readinessStatus).toBe("missing-skill-levels");
    expect(result.skillRequirements).toContainEqual(expect.objectContaining({
      skill: "Agility",
      currentLevel: 55,
      level: 60,
      met: false
    }));
    expect(result.missingRequirements).toContain("Agility 60");
  });

  it("reports missing prerequisite quests", () => {
    const result = evaluateDiaryTier("Ardougne", "Medium", ardougneDiary, {
      skills: skillsFromLevels({}),
      bankItems: [
        { name: "Rope", quantity: 1 },
        { name: "Plank", quantity: 2 },
        { name: "Mith grapple", quantity: 1 }
      ]
    });

    expect(result.readinessStatus).toBe("missing-quests");
    expect(result.questRequirements).toContainEqual(expect.objectContaining({
      name: "Biohazard",
      met: false
    }));
  });

  it("matches present, missing and too-low-quantity bank items", () => {
    const result = evaluateDiaryTier("Ardougne", "Medium", ardougneDiary, {
      skills: skillsFromLevels({}),
      completedQuests: ["Biohazard"],
      bankItems: [
        { name: "Rope", quantity: 1 },
        { name: "Plank", quantity: 1 }
      ],
      accountType: "regular"
    });

    expect(result.readinessStatus).toBe("missing-items");
    expect(result.bank.owned.map((req) => req.name)).toEqual(["Rope"]);
    expect(result.bank.missing).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: "Plank",
        ownedQuantity: 1,
        missingQuantity: 1,
        availabilityStatus: "missing-buyable",
        availabilityCopy: "Buy or grab 2 planks."
      }),
      expect.objectContaining({ name: "Mith grapple", ownedQuantity: 0, missingQuantity: 1 })
    ]));
  });

  it("accepts alternative diary items", () => {
    const result = evaluateDiaryTier("Ardougne", "Medium", ardougneDiary, {
      skills: skillsFromLevels({}),
      completedQuests: ["Biohazard"],
      bankItems: [
        { name: "Rope", quantity: 1 },
        { name: "Plank", quantity: 2 },
        { name: "Mith grapple tip", quantity: 1 }
      ]
    });

    expect(result.readinessStatus).toBe("ready");
    expect(result.itemRequirements[2]).toMatchObject({
      name: "Mith grapple",
      ownedInBank: true,
      ownedName: "Mith grapple tip"
    });
  });

  it("uses staging language for Ultimate Ironman instead of normal bank-ready", () => {
    const result = evaluateDiaryTier("Ardougne", "Medium", ardougneDiary, {
      skills: skillsFromLevels({}),
      completedQuests: ["Biohazard"],
      bankItems: [
        { name: "Rope", quantity: 1 },
        { name: "Plank", quantity: 2 },
        { name: "Mith grapple", quantity: 1 }
      ],
      accountType: "ultimate"
    });

    expect(result.readinessStatus).toBe("partially-ready");
    expect(result.bank.notApplicable).toBe(true);
    expect(result.accountWarnings.join(" ")).toContain("staging checklist");
    expect(result.itemRequirements.find((req) => req.name === "Mith grapple")).toMatchObject({
      availabilityStatus: "owned"
    });
  });

  it("uses UIM staging copy for missing diary items", () => {
    const result = evaluateDiaryTier("Ardougne", "Medium", ardougneDiary, {
      skills: skillsFromLevels({}),
      completedQuests: ["Biohazard"],
      bankItems: [
        { name: "Rope", quantity: 1 }
      ],
      accountType: "ultimate"
    });

    expect(result.bank.notApplicable).toBe(true);
    expect(result.itemRequirements.find((req) => req.name === "Plank")).toMatchObject({
      availabilityStatus: "uim-stage-manually",
      availabilityCopy: "Stage/carry 2 planks before starting."
    });
  });

  it("marks plugin-synced completed diary tiers as completed", () => {
    const result = evaluateDiaryTier("Ardougne", "Medium", ardougneDiary, {
      skills: skillsFromLevels({}),
      completedDiaryTiers: ["Ardougne:Medium"]
    });

    expect(result.readinessStatus).toBe("completed");
    expect(result.missingRequirements).toEqual([]);
    expect(result.tasksLeft).toEqual([]);
  });
});
