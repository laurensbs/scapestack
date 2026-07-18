import { describe, expect, it } from "vitest";
import {
  makePlanSmarterCopy,
  recommendationPlanSurface,
  skillingBankSummaryForSkill,
  skillingLevelGapLine
} from "@/lib/next-plan-surface";

describe("next plan surface boundary", () => {
  it("keeps combat and AFK copy decisions outside the /next client UI", () => {
    expect(recommendationPlanSurface({ kind: "kc", routeTags: ["bossing"] } as any)).toBe("combat");
    expect(makePlanSmarterCopy({ kind: "kc", routeTags: ["bossing"] } as any)).toMatchObject({
      title: "Add bank",
      helper: "Gear, food and teleports can change the trip.",
      bankCta: "Add bank"
    });

    expect(recommendationPlanSurface({ kind: "skill", routeTags: ["afk"] } as any)).toBe("afk");
    expect(makePlanSmarterCopy({ kind: "skill", routeTags: ["afk"] } as any)).toMatchObject({
      title: "Want a sharper pick?",
      emptyHelper: "Skip this for simple level pushes."
    });
  });

  it("turns banked skilling supplies into player-facing XP progress", () => {
    const summary = skillingBankSummaryForSkill(
      "Cooking",
      [
        {
          id: 383,
          name: "Raw shark",
          quantity: 100,
          unitPrice: 0,
          stackValue: 0,
          subtab: "Food",
          slot: null,
          weight: 0
        }
      ],
      {
        totalHours: 0,
        perSkill: [
          {
            skill: "Cooking",
            currentLevel: 80,
            currentXp: 2_000_000,
            targetLevel: 99,
            xpRemaining: 1_000_000,
            xpPerHour: 400_000,
            hours: 2.5
          }
        ]
      }
    );

    expect(summary).toMatchObject({
      skill: "Cooking",
      bankXp: 21_000,
      bankItemsLabel: "100 raw shark",
      bankXpRangeLabel: "about 13,650-21,000",
      hasBankMatch: true,
      suppliesLabel: "raw food",
      actionVerb: "Cook"
    });
    expect(skillingLevelGapLine(summary)).toBe("Cooking: 1,000,000 XP left for 99.");
  });
});
