import { describe, expect, it } from "vitest";
import { evaluateQuestRequirements, normalizeQuestBankItems } from "@/lib/quest-requirements";
import type { QuestRecord } from "@/lib/quest-db";
import type { HiscoreSkill } from "@/lib/hiscores";

const quest: QuestRecord = {
  name: "Animal Magnetism",
  difficulty: "Intermediate",
  length: "Medium",
  qpReq: 0,
  skillReqs: [
    { skill: "Ranged", level: 30 },
    { skill: "Slayer", level: 18 }
  ],
  questReqs: ["The Restless Ghost", "Priest in Peril"],
  itemReqs: [
    {
      id: "mithril-axe-1",
      name: "Mithril axe",
      quantity: 1,
      note: "Mithril axe only",
      alternatives: []
    },
    {
      id: "iron-bar-2",
      name: "iron bar",
      quantity: 5,
      alternatives: []
    },
    {
      id: "bucket-of-milk-3",
      name: "Bucket of milk",
      quantity: 1,
      alternatives: [{ name: "bucket", quantity: 1, note: "Milk it during the quest" }]
    }
  ],
  ironmanNotes: ["Holy symbol requires Prayer 31."]
};

function skill(name: string, level: number): HiscoreSkill {
  return { id: 1, name, level, rank: 0, xp: 0 };
}

function itemQuest(itemReqs: QuestRecord["itemReqs"]): QuestRecord {
  return {
    name: "Cook's Assistant",
    difficulty: "Novice",
    length: "Short",
    qpReq: 0,
    skillReqs: [],
    questReqs: [],
    itemReqs,
    ironmanNotes: []
  };
}

describe("quest requirement matching", () => {
  it("matches completed and missing skill, quest and item requirements", () => {
    const result = evaluateQuestRequirements(quest, {
      skills: [skill("Ranged", 40), skill("Slayer", 12)],
      completedQuests: ["The Restless Ghost"],
      bankItems: [
        { name: "Mithril axe", quantity: 1 },
        { name: "Iron bar", quantity: 3 },
        { name: "Bucket", quantity: 1 }
      ],
      accountType: "regular"
    });

    expect(result.readinessStatus).toBe("missing-skill-levels");
    expect(result.skillRequirements).toMatchObject([
      { skill: "Ranged", met: true, currentLevel: 40 },
      { skill: "Slayer", met: false, currentLevel: 12 }
    ]);
    expect(result.questRequirements).toMatchObject([
      { name: "The Restless Ghost", met: true },
      { name: "Priest in Peril", met: false }
    ]);
    expect(result.itemRequirements).toMatchObject([
      { name: "Mithril axe", ownedInBank: true, missingQuantity: 0 },
      { name: "iron bar", ownedInBank: false, ownedQuantity: 3, missingQuantity: 2 },
      { name: "Bucket of milk", ownedInBank: true, ownedName: "Bucket" }
    ]);
    expect(result.bank.owned.map((req) => req.name)).toEqual(["Mithril axe", "Bucket of milk"]);
    expect(result.bank.missing.map((req) => req.name)).toEqual(["iron bar"]);
    expect(result.completedRequirements).toContain("Ranged 30");
    expect(result.missingRequirements).toContain("Slayer 18");
    expect(result.missingRequirements).toContain("Priest in Peril");
    expect(result.missingRequirements).toContain("5x iron bar");
  });

  it("marks a quest ready to start when the required bank item is present", () => {
    const result = evaluateQuestRequirements(itemQuest([
      {
        id: "egg-1",
        name: "Egg",
        quantity: 1,
        alternatives: []
      }
    ]), {
      bankItems: [{ id: 1944, name: "Egg", quantity: 1 }],
      accountType: "regular"
    });

    expect(result.readinessStatus).toBe("ready-to-start");
    expect(result.itemRequirements[0]).toMatchObject({
      name: "Egg",
      ownedInBank: true,
      ownedQuantity: 1,
      missingQuantity: 0
    });
  });

  it("marks missing bank items when a required item is absent", () => {
    const result = evaluateQuestRequirements(itemQuest([
      {
        id: "pot-of-flour-1",
        name: "Pot of flour",
        quantity: 1,
        alternatives: []
      }
    ]), {
      bankItems: [{ id: 1944, name: "Egg", quantity: 1 }]
    });

    expect(result.readinessStatus).toBe("missing-bank-items");
    expect(result.bank.missing.map((req) => req.name)).toEqual(["Pot of flour"]);
    expect(result.itemRequirements[0]).toMatchObject({
      ownedInBank: false,
      ownedQuantity: 0,
      missingQuantity: 1
    });
  });

  it("adds Normal buyable item availability copy", () => {
    const result = evaluateQuestRequirements(itemQuest([
      {
        id: "plank-1",
        name: "Plank",
        quantity: 2,
        alternatives: []
      }
    ]), {
      bankItems: [{ id: 1944, name: "Egg", quantity: 1 }],
      accountType: "regular"
    });

    expect(result.itemRequirements[0]).toMatchObject({
      availabilityStatus: "missing-buyable",
      availabilityCopy: "Buy or grab 2 planks."
    });
  });

  it("adds Ironman self-source item availability copy", () => {
    const result = evaluateQuestRequirements(itemQuest([
      {
        id: "plank-1",
        name: "Plank",
        quantity: 2,
        alternatives: []
      }
    ]), {
      bankItems: [{ id: 1944, name: "Egg", quantity: 1 }],
      accountType: "ironman"
    });

    expect(result.itemRequirements[0]).toMatchObject({
      availabilityStatus: "missing-shop-source",
      availabilityCopy: "Source 2 planks yourself; sawmill/Construction route."
    });
  });

  it("adds UIM staging item availability copy", () => {
    const result = evaluateQuestRequirements(itemQuest([
      {
        id: "plank-1",
        name: "Plank",
        quantity: 2,
        alternatives: []
      }
    ]), {
      bankItems: [{ id: 1944, name: "Egg", quantity: 1 }],
      accountType: "ultimate"
    });

    expect(result.itemRequirements[0]).toMatchObject({
      availabilityStatus: "uim-stage-manually",
      availabilityCopy: "Stage/carry 2 planks before starting."
    });
  });

  it("adds Group Ironman own-bank item availability copy", () => {
    const result = evaluateQuestRequirements(itemQuest([
      {
        id: "plank-1",
        name: "Plank",
        quantity: 2,
        alternatives: []
      }
    ]), {
      bankItems: [{ id: 1944, name: "Egg", quantity: 1 }],
      accountType: "group"
    });

    expect(result.itemRequirements[0]).toMatchObject({
      availabilityStatus: "missing-shop-source",
      availabilityCopy: "Check own bank; group storage not verified for 2 planks."
    });
  });

  it("marks missing bank items when quantity is too low", () => {
    const result = evaluateQuestRequirements(itemQuest([
      {
        id: "iron-bar-1",
        name: "Iron bar",
        quantity: 5,
        alternatives: []
      }
    ]), {
      bankItems: [
        { id: 2351, name: "Iron bar", quantity: 2 },
        { id: 2351, name: "Iron bar", quantity: 1 }
      ]
    });

    expect(result.readinessStatus).toBe("missing-bank-items");
    expect(result.itemRequirements[0]).toMatchObject({
      ownedInBank: false,
      ownedQuantity: 3,
      missingQuantity: 2
    });
  });

  it("accepts an alternative item as quest-ready", () => {
    const result = evaluateQuestRequirements(itemQuest([
      {
        id: "bucket-of-milk-1",
        name: "Bucket of milk",
        quantity: 1,
        alternatives: [{ name: "Bucket", quantity: 1, note: "Milk it during the quest" }]
      }
    ]), {
      bankItems: [{ id: 1925, name: "Bucket", quantity: 1 }]
    });

    expect(result.readinessStatus).toBe("ready-to-start");
    expect(result.itemRequirements[0]).toMatchObject({
      ownedInBank: true,
      ownedName: "Bucket",
      missingQuantity: 0,
      availabilityStatus: "owned"
    });
  });

  it("normalizes RuneLite bank item ids and names before matching quantities", () => {
    expect(normalizeQuestBankItems([
      { id: 2351, name: "Iron bar", quantity: 2 },
      { id: 2351, name: "iron bar", quantity: 3 },
      { name: "  Eggs  ", quantity: 1 },
      { name: "egg", quantity: 2 }
    ])).toEqual([
      { id: 2351, name: "Iron bar", quantity: 5 },
      { name: "Eggs", quantity: 3 }
    ]);
  });

  it("marks UIM bank readiness as not applicable and emits account warnings", () => {
    const result = evaluateQuestRequirements(quest, {
      bankItems: [{ name: "Mithril axe", quantity: 1 }],
      accountType: "ultimate"
    });

    expect(result.readinessStatus).toBe("missing-skill-levels");
    expect(result.bank.notApplicable).toBe(true);
    expect(result.accountWarnings.join(" ")).toContain("Ultimate Ironman");
    expect(result.accountWarnings.join(" ")).toContain("Ironman note");
  });

  it("marks UIM item readiness as partially ready when only bank checks are unresolved", () => {
    const result = evaluateQuestRequirements(itemQuest([
      {
        id: "rope-1",
        name: "Rope",
        quantity: 1,
        alternatives: []
      }
    ]), {
      bankItems: [{ id: 954, name: "Rope", quantity: 1 }],
      accountType: "ultimate"
    });

    expect(result.readinessStatus).toBe("partially-ready");
    expect(result.bank.notApplicable).toBe(true);
    expect(result.bank.owned.map((req) => req.name)).toEqual(["Rope"]);
  });

  it("warns iron accounts that item availability is self-sourced", () => {
    const result = evaluateQuestRequirements(quest, {
      accountType: "ironman",
      bankItems: []
    });

    expect(result.accountWarnings.join(" ")).toContain("Ironman");
    expect(result.accountWarnings.join(" ")).toContain("self-sourcing");
  });

  it("does not treat Group Ironman item availability as a normal account", () => {
    const result = evaluateQuestRequirements(quest, {
      accountType: "group",
      bankItems: []
    });

    expect(result.accountWarnings.join(" ")).toContain("Group Ironman");
    expect(result.accountWarnings.join(" ")).toContain("group storage is not assumed");
  });

  it("warns Hardcore Ironman about risky self-sourcing", () => {
    const result = evaluateQuestRequirements(quest, {
      accountType: "hardcore",
      bankItems: []
    });

    expect(result.accountWarnings.join(" ")).toContain("Hardcore Ironman");
    expect(result.accountWarnings.join(" ")).toContain("avoid risky combat sources");
  });
});
