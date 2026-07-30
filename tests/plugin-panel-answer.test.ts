import { describe, expect, it } from "vitest";
import { recommendationToPluginPanelAnswer } from "@/lib/plugin-panel-answer";
import type { NextUpInput, Recommendation } from "@/lib/next-up";

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
      stopAt: "20 kills",
      current: "7 / 20",
      left: "~34 min"
    });
  });
});
