import { describe, expect, it, vi } from "vitest";
import type { DiaryRecord } from "@/lib/diary-db";
import { evaluateDiaryTier } from "@/lib/diary-requirements";
import type { HiscoreSkill } from "@/lib/hiscores";
import { computeNextUp } from "@/lib/next-up";
import { pluginBankStatusLabel } from "@/lib/plugin-bank-status";
import type { QuestRecord } from "@/lib/quest-db";
import { evaluateQuestRequirements } from "@/lib/quest-requirements";

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
    Medium: { skills: [{ skill: "Fishing", level: 46 }] },
    Hard: { skills: [{ skill: "Thieving", level: 72 }] },
    Elite: { skills: [{ skill: "Magic", level: 94 }] }
  }
};

const questWithItems: QuestRecord = {
  name: "Session Test Quest",
  difficulty: "Novice",
  length: "Short",
  qpReq: 0,
  skillReqs: [{ skill: "Agility", level: 35 }],
  questReqs: ["Biohazard"],
  itemReqs: [
    { id: "rope", name: "Rope", quantity: 1, alternatives: [] },
    { id: "plank", name: "Plank", quantity: 2, alternatives: [] }
  ],
  ironmanNotes: []
};

describe("end-to-end syncflow regression contracts", () => {
  it("uses RuneLite sync as the authoritative account mode and bank signal for /next", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T13:00:00.000Z"));

    const bankStatus = {
      enabled: true,
      itemCount: 2,
      capturedAt: "2026-07-08T12:55:00.000Z",
      unavailableReason: null
    };
    const result = await computeNextUp({
      skills: skillsFromLevels({ Fishing: 43, Thieving: 70 }),
      bank: [
        { id: 954, name: "Rope" },
        { id: 960, name: "Plank" }
      ],
      accountMeta: {
        displayName: "WOM Main",
        accountType: "regular",
        ehp: 100,
        ehb: 20,
        lastChangedAt: null
      },
      scapestackSync: {
        displayName: "Plugin Iron",
        accountType: "ironman",
        questsCompleted: ["Biohazard"],
        diariesCompleted: [{ region: "Ardougne", tier: "Easy" }],
        collectionLogItemIds: [],
        bankStatus
      },
      syncedSources: {
        wom: true,
        temple: false,
        collectionLog: false,
        scapestack: {
          syncedAt: "2026-07-08T12:55:00.000Z",
          quests: 1,
          diaries: 1,
          clItems: 0,
          pluginVersion: "0.2.0",
          bankStatus
        }
      }
    });

    expect(result.summary.accountMode).toMatchObject({
      type: "ironman",
      confidence: "detected",
      source: "scapestack-sync",
      badgeLabel: "Ironman detected"
    });
    expect(result.pathProgress.syncedSources?.scapestack?.bankStatus).toMatchObject({
      enabled: true,
      itemCount: 2
    });
    expect(pluginBankStatusLabel(bankStatus, result.summary.accountType)).toBe("Bank synced: 2 item stacks");

    vi.useRealTimers();
  });

  it("degrades safely when account mode and bank context are both unknown", async () => {
    const result = await computeNextUp({
      skills: skillsFromLevels({ Attack: 40, Strength: 40, Defence: 40, Hitpoints: 40 })
    });

    expect(result.summary.accountType).toBeNull();
    expect(result.summary.accountMode).toMatchObject({
      confidence: "unknown",
      badgeLabel: "Account mode unknown"
    });
    expect(result.summary.accountMode.planningNote).toContain("bank readiness only counts when real bank data exists");
    expect(pluginBankStatusLabel(null, result.summary.accountType)).toBe("Bank status unknown");
  });

  it("keeps quest readiness tied to synced skills, quests, bank items and account type", () => {
    const result = evaluateQuestRequirements(questWithItems, {
      skills: skillsFromLevels({ Agility: 35 }),
      completedQuests: ["Biohazard"],
      bankItems: [
        { id: 954, name: "Rope", quantity: 1 },
        { id: 960, name: "Plank", quantity: 1 }
      ],
      accountType: "ironman"
    });

    expect(result.readinessStatus).toBe("missing-bank-items");
    expect(result.completedRequirements).toEqual(expect.arrayContaining(["Agility 35", "Biohazard", "1x Rope"]));
    expect(result.bank.missing).toContainEqual(expect.objectContaining({
      name: "Plank",
      ownedQuantity: 1,
      missingQuantity: 1,
      availabilityStatus: "missing-shop-source",
      availabilityCopy: "Source 2 planks yourself; sawmill/Construction route."
    }));
    expect(result.accountWarnings.join(" ")).toContain("self-sourcing");
  });

  it("makes diary unlock blockers exact and skips completed plugin-synced tiers", () => {
    const blocked = evaluateDiaryTier("Ardougne", "Medium", ardougneDiary, {
      skills: skillsFromLevels({ Fishing: 43 }),
      completedQuests: [],
      completedDiaryTiers: [{ region: "Ardougne", tier: "Easy" }],
      bankItems: [{ name: "Rope", quantity: 1 }],
      accountType: "group"
    });

    expect(blocked.readinessStatus).toBe("missing-skill-levels");
    expect(blocked.missingRequirements).toEqual(expect.arrayContaining([
      "Fishing 46",
      "Biohazard",
      "2x Plank",
      "Mith grapple"
    ]));
    expect(blocked.completedRequirements).toEqual(expect.arrayContaining([
      "Ardougne Easy diary",
      "Rope"
    ]));
    expect(blocked.accountWarnings.join(" ")).toContain("group storage is not assumed");

    const completed = evaluateDiaryTier("Ardougne", "Medium", ardougneDiary, {
      completedDiaryTiers: [{ region: "Ardougne", tier: "Medium" }]
    });

    expect(completed.readinessStatus).toBe("completed");
    expect(completed.tasksLeft).toEqual([]);
    expect(completed.missingRequirements).toEqual([]);
  });

  it("uses UIM staging language instead of normal bank-ready readiness", () => {
    const quest = evaluateQuestRequirements(questWithItems, {
      skills: skillsFromLevels({ Agility: 35 }),
      completedQuests: ["Biohazard"],
      bankItems: [{ name: "Rope", quantity: 1 }],
      accountType: "ultimate"
    });
    const diary = evaluateDiaryTier("Ardougne", "Medium", ardougneDiary, {
      skills: skillsFromLevels({ Fishing: 46 }),
      completedQuests: ["Biohazard"],
      completedDiaryTiers: [{ region: "Ardougne", tier: "Easy" }],
      bankItems: [{ name: "Rope", quantity: 1 }],
      accountType: "ultimate"
    });

    expect(quest.readinessStatus).toBe("partially-ready");
    expect(quest.bank.notApplicable).toBe(true);
    expect(quest.bank.missing.find((item) => item.name === "Plank")).toMatchObject({
      availabilityStatus: "uim-stage-manually",
      availabilityCopy: "Stage/carry 2 planks before starting."
    });
    expect(diary.readinessStatus).toBe("partially-ready");
    expect(diary.bank.notApplicable).toBe(true);
    expect(pluginBankStatusLabel({ enabled: true, itemCount: 10, capturedAt: "2026-07-08T12:00:00.000Z", unavailableReason: null }, "ultimate"))
      .toBe("UIM: bank checks are staging only");
  });
});
