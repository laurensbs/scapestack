import { describe, expect, it } from "vitest";
import { recommendationToPluginPanelAnswer } from "@/lib/plugin-panel-answer";
import type { NextUpInput, Recommendation } from "@/lib/next-up";
import { createPinnedGoal } from "@/lib/pinned-goals";

describe("RuneLite panel answer receipt", () => {
  it("turns a measured boss recommendation into stop/current/left fields", () => {
    const input: NextUpInput = {
      bossKc: { Vorkath: 7 },
      skills: [],
      bank: []
    };
    const recommendation = {
      id: "vorkath-trip",
      kind: "kc",
      title: "Vorkath",
      why: "Blowpipe + dragon darts are in your bank.",
      score: 99,
      completionTarget: { kind: "boss_kc_at_least", boss: "vorkath", target: 20 },
      actionPlan: {
        timebox: "~34 min",
        confidence: "exact",
        confidenceLabel: "Measured",
        prep: "Bank once.",
        steps: ["Kill Vorkath."],
      }
    } satisfies Recommendation;

    expect(recommendationToPluginPanelAnswer(recommendation, input)).toEqual({
      title: "Vorkath",
      detail: "Blowpipe + dragon darts are in your bank.",
      stopAt: "Kill Vorkath.",
      current: "7 / 20",
      left: "~34 min",
      spriteItemId: null
    });
  });

  it("puts the next step under the player's pinned goal", () => {
    const goal = createPinnedGoal({
      kind: "unlock",
      unlockId: "barrows-gloves",
      pinnedAt: "2026-07-31T10:00:00.000Z"
    })!;
    const input: NextUpInput = { skills: [], bank: [] };
    const recommendation = {
      id: "quest:monkey-madness-i",
      kind: "quest",
      title: "Monkey Madness I",
      why: "Finish the next quest gate.",
      score: 99,
      completionTarget: { kind: "quest_completed", quest: "Monkey Madness I" },
      actionPlan: {
        timebox: "One quest",
        confidence: "exact",
        confidenceLabel: "Measured",
        prep: "Bring combat gear.",
        steps: ["Jungle Demon"]
      }
    } satisfies Recommendation;

    expect(recommendationToPluginPanelAnswer(
      recommendation,
      input,
      goal,
      { fraction: "7/10", percent: 70, done: false, note: null }
    )).toEqual({
      title: "Monkey Madness I",
      detail: "toward Barrows gloves",
      stopAt: "Jungle Demon",
      current: "7/10",
      left: "One quest",
      spriteItemId: goal.spriteItemId
    });
  });
});
