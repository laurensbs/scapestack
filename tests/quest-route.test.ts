import { describe, expect, it } from "vitest";
import { buildQuestRoute } from "@/lib/quest-route";
import type { QuestRecord } from "@/lib/quest-db";
import type { HiscoreSkill } from "@/lib/hiscores";

function quest(input: Partial<QuestRecord> & Pick<QuestRecord, "name">): QuestRecord {
  return {
    name: input.name,
    difficulty: input.difficulty ?? "Intermediate",
    length: input.length ?? "Medium",
    qpReq: input.qpReq ?? 0,
    skillReqs: input.skillReqs ?? [],
    questReqs: input.questReqs ?? [],
    itemReqs: input.itemReqs ?? [],
    ironmanNotes: input.ironmanNotes ?? []
  };
}

function skill(name: string, level: number): HiscoreSkill {
  return { id: 1, name, level, rank: 0, xp: 0 };
}

const first = quest({ name: "First Footing", length: "Very Short" });
const middle = quest({
  name: "Middle Ground",
  length: "Medium",
  questReqs: [first.name],
  skillReqs: [{ skill: "Agility", level: 40 }],
  itemReqs: [{ id: "rope", name: "Rope", quantity: 1, alternatives: [] }]
});
const target = quest({
  name: "Perfect City",
  difficulty: "Grandmaster",
  length: "Very Long",
  questReqs: [middle.name, first.name],
  itemReqs: Array.from({ length: 12 }, (_, index) => ({
    id: `target-${index}`,
    name: `Target item ${index}`,
    quantity: 1,
    alternatives: []
  }))
});
const quests = new Map([first, middle, target].map((record) => [record.name, record]));

describe("quest prerequisite routes", () => {
  it("selects the first executable unfinished prerequisite", () => {
    const route = buildQuestRoute(target, quests, {
      completedQuestNames: [first.name],
      completionEvidence: "runelite",
      skills: [skill("Agility", 50)],
      bankItems: [{ name: "Rope", quantity: 1 }],
      payoff: "the Perfect City"
    });

    expect(route.progress).toMatchObject({
      activeQuestName: middle.name,
      activeIsTarget: false,
      completionEvidence: "runelite",
      completedPrerequisites: [first.name],
      remainingPrerequisites: [middle.name],
      nextQuestName: target.name,
      ownedItems: ["Rope"],
      missingItems: [],
      expectedBlock: "45-75 min",
      prerequisiteDepth: "long"
    });
    expect(route.progress.whyThisBlock).toContain("first executable block");
    expect(route.progress.stopPoint).toBe(`Finish ${middle.name}, then replan the next block toward ${target.name}.`);
  });

  it("never returns a completed prerequisite as the active block", () => {
    const route = buildQuestRoute(target, quests, {
      completedQuestNames: [first.name, middle.name],
      completionEvidence: "runelite",
      skills: [skill("Agility", 50)],
      payoff: "the Perfect City"
    });

    expect(route.progress.activeQuestName).toBe(target.name);
    expect(route.progress.activeIsTarget).toBe(true);
    expect(route.progress.remainingPrerequisites).toEqual([]);
  });

  it("uses only the active block for bank and skill preparation", () => {
    const route = buildQuestRoute(target, quests, {
      completedQuestNames: [first.name],
      skills: [skill("Agility", 37)],
      bankItems: [{ name: "Rope", quantity: 1 }],
      payoff: "the Perfect City"
    });

    expect(route.progress.skillPreparation).toEqual(["Train Agility 37 -> 40"]);
    expect(route.progress.ownedItems).toEqual(["Rope"]);
    expect(route.progress.ownedItems.join(" ")).not.toContain("Target item");
    expect(route.progress.boostAssumption).toContain("No boosts assumed");
  });

  it("does not invent completed prerequisites without RuneLite or tracker evidence", () => {
    const route = buildQuestRoute(target, quests, {
      skills: [skill("Agility", 50)],
      payoff: "the Perfect City"
    });

    expect(route.progress.activeQuestName).toBe(target.name);
    expect(route.progress.completionEvidence).toBe("unknown");
    expect(route.progress.completedPrerequisites).toEqual([]);
    expect(route.progress.prerequisiteDepth).toBe("long");
    expect(route.progress.whyThisBlock).toContain("will not guess");
  });
});
