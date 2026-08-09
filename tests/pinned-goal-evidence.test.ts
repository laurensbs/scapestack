import { describe, expect, it } from "vitest";
import { buildPinnedGoalEvidence } from "@/lib/pinned-goal-evidence";
import { createPinnedGoal, pinnedGoalProgress } from "@/lib/pinned-goals";
import type { QuestRecord } from "@/lib/quest-db";

function quest(name: string, questReqs: string[] = []): QuestRecord {
  return {
    name,
    difficulty: null,
    length: null,
    qpReq: 0,
    skillReqs: [],
    questReqs,
    itemReqs: [],
    ironmanNotes: []
  };
}

const quests = new Map([
  ["Priest in Peril", quest("Priest in Peril")],
  ["Fairytale I - Growing Pains", quest("Fairytale I - Growing Pains")],
  ["Fairytale II - Cure a Queen", quest("Fairytale II - Cure a Queen")]
]);

describe("pinned goal evidence", () => {
  it("uses exact quest and bank facts for a fraction and refuses to guess without them", () => {
    const goal = createPinnedGoal({ kind: "unlock", unlockId: "fairy-rings" })!;
    const exact = buildPinnedGoalEvidence({
      skills: [],
      quests,
      questsCompleted: ["Priest in Peril", "Fairytale I - Growing Pains", "Fairytale II - Cure a Queen"],
      bankItems: [{ id: 772, name: "Dramen staff", quantity: 1 }]
    });
    expect(pinnedGoalProgress(goal, exact)).toEqual({ fraction: "3/3", percent: 100, done: true, note: null });
    const itemGoal = createPinnedGoal({ kind: "item", goalId: "fire-cape" })!;
    const itemEvidence = buildPinnedGoalEvidence({
      skills: [],
      quests,
      bankItems: [{ id: 6570, name: "Fire cape", quantity: 1 }]
    });
    expect(pinnedGoalProgress(itemGoal, itemEvidence)).toEqual({ fraction: "1/1", percent: 100, done: true, note: null });

    const hiscoresOnly = buildPinnedGoalEvidence({ skills: [], quests });
    expect(pinnedGoalProgress(goal, hiscoresOnly)).toEqual({
      fraction: null,
      percent: null,
      done: false,
      note: "Needs RuneLite to see finished quests"
    });
  });
});
