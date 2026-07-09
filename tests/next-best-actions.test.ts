import { describe, expect, it } from "vitest";
import { computeNextUp } from "@/lib/next-up";
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
    level: levels[name] ?? 70,
    xp: 737_627
  }));
  const totalLevel = skills.reduce((sum, skill) => sum + skill.level, 0);
  return [{ id: 0, name: "Overall", rank: 1, level: totalLevel, xp: 0 }, ...skills];
}

describe("next best actions", () => {
  it("surfaces a ready quest action with unlock value", async () => {
    const result = await computeNextUp({
      skills: skillsFromLevels({}),
      bank: [{ id: 1511, name: "Logs", quantity: 6 }]
    });

    const action = result.nextBestActions.find((candidate) => candidate.title === "Do Tree Gnome Village");

    expect(action).toMatchObject({
      kind: "do-quest",
      reason: expect.stringContaining("unlocks Spirit Trees"),
      relevantQuestOrUnlock: "Spirit Trees",
      missingRequirements: [],
      preparation: "Low"
    });
    expect(action?.unlockValue).toBeGreaterThanOrEqual(90);
  });

  it("uses bank contents to recommend collecting the remaining quest items", async () => {
    const result = await computeNextUp({
      skills: skillsFromLevels({ Woodcutting: 35, Ranged: 30, Crafting: 19, Slayer: 18 }),
      templeQuestsCompleted: ["The Restless Ghost", "Ernest the Chicken", "Priest in Peril"],
      bank: [
        { id: 1355, name: "Mithril axe", quantity: 1 },
        { id: 2351, name: "Iron bar", quantity: 5 },
        { id: 552, name: "Ghostspeak amulet", quantity: 1 },
        { id: 2347, name: "Hammer", quantity: 1 },
        { id: 1743, name: "Hard leather", quantity: 1 }
      ]
    });

    const action = result.nextBestActions.find((candidate) => candidate.title === "Collect 3 items for Animal Magnetism");

    expect(action).toMatchObject({
      kind: "collect-items",
      relevantQuestOrUnlock: "Ava's device",
      missingRequirements: expect.arrayContaining(["20x ecto-token", "Holy symbol", "Polished buttons"])
    });
    expect(action?.requiredItems.join(" ")).toContain("Mithril axe");
  });

  it("can build quest item actions from bank-only context", async () => {
    const result = await computeNextUp({
      bank: [{ id: 1511, name: "Logs", quantity: 6 }]
    });

    expect(result.summary.basis).toBe("bank-only");
    expect(result.nextBestActions.some((action) => action.title === "Do Tree Gnome Village")).toBe(true);
  });

  it("recommends a small skill gap before a quest chain", async () => {
    const result = await computeNextUp({
      skills: skillsFromLevels({ Agility: 33 }),
      bank: [
        { id: 554, name: "Fire rune", quantity: 1 },
        { id: 556, name: "Air rune", quantity: 1 },
        { id: 555, name: "Water rune", quantity: 1 },
        { id: 557, name: "Earth rune", quantity: 1 },
        { id: 1277, name: "Bronze sword", quantity: 1 },
        { id: 882, name: "Bronze arrow", quantity: 1 },
        { id: 1775, name: "Molten glass", quantity: 1 },
        { id: 590, name: "Tinderbox", quantity: 1 },
        { id: 2347, name: "Hammer", quantity: 1 },
        { id: 1539, name: "Steel nails", quantity: 60 },
        { id: 960, name: "Plank", quantity: 2 },
        { id: 1939, name: "Swamp tar", quantity: 1 }
      ]
    });

    const action = result.nextBestActions.find((candidate) => candidate.title === "Train Agility to 35 for Horror from the Deep");

    expect(action).toMatchObject({
      kind: "train-skill",
      missingRequirements: ["Agility 33/35"],
      relevantQuestOrUnlock: "God books and dagannoth quest chain"
    });
  });

  it("adds accounttype warnings to iron-sensitive item actions", async () => {
    const result = await computeNextUp({
      skills: skillsFromLevels({ Woodcutting: 35, Ranged: 30, Crafting: 19, Slayer: 18 }),
      templeQuestsCompleted: ["The Restless Ghost", "Ernest the Chicken", "Priest in Peril"],
      bank: [],
      scapestackSync: {
        accountType: "ultimate_ironman",
        questsCompleted: ["The Restless Ghost", "Ernest the Chicken", "Priest in Peril"],
        diariesCompleted: [],
        collectionLogItemIds: []
      }
    });

    const action = result.nextBestActions.find((candidate) => candidate.title === "Do Animal Magnetism");

    expect(result.summary.accountType).toBe("ultimate");
    expect(action?.accountTypeNote).toContain("Ultimate Ironman");
  });

  it("recommends a concrete diary skill blocker", async () => {
    const result = await computeNextUp({
      skills: skillsFromLevels({
        Smithing: 75,
        Defence: 70,
        Fishing: 70,
        Prayer: 70,
        Fletching: 70,
        Firemaking: 65,
        Agility: 59
      }),
      bank: [
        { id: 9419, name: "Mith grapple", quantity: 1 },
        { id: 9185, name: "Rune crossbow", quantity: 1 }
      ]
    });

    const action = result.nextBestActions.find((candidate) => candidate.title === "Train Agility to 60 for Kandarin Hard diary");

    expect(action).toMatchObject({
      kind: "train-diary-skill",
      missingRequirements: ["60 Agility needed, you have 59"],
      relevantQuestOrUnlock: "Kandarin Hard diary"
    });
  });

  it("does not recommend a diary tier that RuneLite sync marks complete", async () => {
    const result = await computeNextUp({
      skills: skillsFromLevels({
        Runecraft: 91,
        Herblore: 87,
        Farming: 72,
        Fishing: 65,
        Magic: 59,
        Agility: 53,
        Cooking: 53,
        Mining: 52,
        Strength: 50,
        Thieving: 50,
        Crafting: 50,
        Woodcutting: 50,
        Slayer: 50,
        Ranged: 42,
        Hunter: 41,
        Smithing: 40
      }),
      scapestackSync: {
        accountType: "normal",
        questsCompleted: [],
        diariesCompleted: [{ region: "Ardougne", tier: "Medium" }],
        collectionLogItemIds: []
      }
    });

    const titles = result.nextBestActions.map((action) => action.title).join(" ");
    const recs = [result.headline, ...result.rest].filter(Boolean);

    expect(titles).not.toContain("Ardougne Medium diary");
    expect(recs.some((rec) => rec?.id === "diary:Ardougne:Medium")).toBe(false);
  });

  it("surfaces concrete diary route cards with exact blockers and stop point", async () => {
    const result = await computeNextUp({
      skills: skillsFromLevels({
        Smithing: 75,
        Defence: 70,
        Fishing: 70,
        Prayer: 70,
        Fletching: 70,
        Firemaking: 65,
        Agility: 59
      }),
      bank: [
        { id: 9419, name: "Mith grapple", quantity: 1 },
        { id: 9185, name: "Rune crossbow", quantity: 1 }
      ]
    });

    const recs = [result.headline, ...result.rest].filter(Boolean);
    const diary = recs.find((rec) => rec?.id === "diary:Kandarin:Hard");

    expect(diary).toMatchObject({
      kind: "diary",
      title: "Train Agility for Kandarin Hard",
      needs: expect.arrayContaining(["60 Agility needed, you have 59"]),
      decisionReason: expect.stringContaining("Finish after:")
    });
    expect(diary?.why).toContain("Kandarin Hard is 1 blocker away");
    expect(diary?.payoff).toContain("Kandarin headgear");
    expect(diary?.actionPlan?.steps.join(" ")).toContain("Clear 60 Agility needed, you have 59");
  });

  it("uses Karamja gloves language for Karamja diary routes", async () => {
    const result = await computeNextUp({
      skills: skillsFromLevels({}),
      templeQuestsCompleted: ["Shilo Village", "Tai Bwo Wannai Trio"],
      bank: [
        { id: 954, name: "Rope", quantity: 1 },
        { id: 995, name: "Coins", quantity: 1000 },
        { id: 11140, name: "Karamja gloves 3", quantity: 1 }
      ],
      scapestackSync: {
        accountType: "normal",
        questsCompleted: ["Shilo Village", "Tai Bwo Wannai Trio"],
        diariesCompleted: [
          { region: "Karamja", tier: "Easy" },
          { region: "Karamja", tier: "Medium" },
          { region: "Karamja", tier: "Hard" }
        ],
        collectionLogItemIds: []
      }
    });

    const visibleRoutes = [result.headline, ...result.rest].filter(Boolean);
    expect(visibleRoutes.some((rec) => rec?.title === "Finish Karamja gloves")).toBe(true);
  });
});
