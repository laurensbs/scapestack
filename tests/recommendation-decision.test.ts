import { describe, expect, it } from "vitest";
import {
  buildRecommendationDecision,
  parseRecommendationDecision,
  recommendationDecisionCopy
} from "@/lib/recommendation-decision";
import type { Recommendation } from "@/lib/next-up";

function recommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: "kc:vorkath:50",
    kind: "kc",
    title: "Push Vorkath to 50 KC",
    why: "Account-specific legacy copy that the decision boundary must not trust.",
    score: 90,
    bossSlug: "vorkath",
    kcMeta: { kc: 48, denom: 5_000, dropName: "Vorkath's skeletal visage" },
    needs: ["Ranged gear", "Food"],
    actionPlan: {
      timebox: "45-60 min",
      confidence: "exact",
      confidenceLabel: "Exact",
      prep: "Take the owned setup.",
      steps: ["Gear for Vorkath and do one trip.", "Stop at 50 KC."],
    },
    ...overrides
  };
}

function build(overrides: Partial<Parameters<typeof buildRecommendationDecision>[0]> = {}) {
  return buildRecommendationDecision({
    winner: recommendation(),
    alternatives: [recommendation({ id: "skill:cooking", kind: "skill", title: "Train Cooking", bossSlug: undefined, kcMeta: undefined })],
    mood: "bossing",
    routeFamily: "boss-log",
    minutes: 60,
    accountStage: "pvm-ready",
    accountType: "regular",
    hasPublicStats: true,
    hasBank: true,
    hasRuneLite: true,
    ...overrides
  });
}

describe("RecommendationDecision contract", () => {
  it("makes goal, stop point and machine-readable completion inseparable", () => {
    const decision = build();

    expect(decision.id).toBe("decision:v1:kc:vorkath:50:boss-log:bossing:60");
    expect(decision.goal.completionRule).toBe(decision.stopPoint.label);
    expect(decision.completion).toEqual({
      mode: "automatic",
      evidence: { kind: "boss_kc_at_least", boss: "vorkath", target: 50, provenance: "runelite" }
    });
    expect(parseRecommendationDecision(decision)).toEqual(decision);
  });

  it("traces every factual reason to stats, bank, RuneLite or preference", () => {
    const decision = build();
    expect(decision.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "boss_kc_progress", provenance: "public_stats", value: 48 }),
      expect.objectContaining({ code: "bank_context_used", provenance: "bank" }),
      expect.objectContaining({ code: "runelite_filtered_finished", provenance: "runelite" }),
      expect.objectContaining({ code: "session_preference_fit", provenance: "preference" })
    ]));
    expect(new Set(decision.reasons.map((reason) => reason.provenance))).toEqual(
      new Set(["public_stats", "bank", "runelite", "preference"])
    );
  });

  it("keeps missing context unknown instead of presenting it as confirmed", () => {
    const decision = build({
      winner: recommendation({ id: "quest:dt2", kind: "quest", title: "Start Desert Treasure II", bossSlug: undefined, kcMeta: undefined }),
      hasPublicStats: false,
      hasBank: false,
      hasRuneLite: false
    });

    expect(decision.reasons).toEqual([
      expect.objectContaining({ code: "session_preference_fit", provenance: "preference" })
    ]);
    expect(decision.setup.required).toEqual([]);
    expect(decision.unknowns.map((unknown) => unknown.code)).toEqual(["public_progress", "runelite_completion"]);
    expect(decision.completion.mode).toBe("manual");
    expect(decision.fallback).toMatchObject({ used: true, missing: ["public_progress", "runelite_completion"] });
  });

  it("records why alternatives lost and generates concise copy only at the boundary", () => {
    const decision = build({ mood: "chill", minutes: 30 });
    const copy = recommendationDecisionCopy(decision);

    expect(decision.alternatives[0]?.lostBecause).toMatchObject({ provenance: "preference" });
    expect(copy).toMatchObject({
      title: "Push Vorkath to 50 KC",
      firstStep: "Gear for Vorkath and do one trip.",
      stopPoint: "Stop at 50 KC."
    });
    expect(copy.why).not.toContain("legacy copy");
  });

  it("rejects contracts with an empty or mismatched completion rule", () => {
    const decision = build();
    expect(parseRecommendationDecision({ ...decision, stopPoint: { label: "" } })).toBeNull();
    expect(parseRecommendationDecision({ ...decision, goal: { ...decision.goal, completionRule: "Different rule" } })).toBeNull();
  });
});
