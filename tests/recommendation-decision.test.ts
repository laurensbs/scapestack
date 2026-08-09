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

describe("the copy says a boss's name, not its URL slug", () => {
  it("names the boss the way a player would", () => {
    // "vardorvis is already at 15 KC" shipped, lowercase, in the sentence
    // under the headline. A slug is a path segment; it is not a word, and no
    // test had ever read this string.
    const copy = recommendationDecisionCopy(build(), { hasBank: true, hasRuneLite: true });
    const line = `${copy.why} ${copy.sourceLine ?? ""}`;
    expect(line).toContain("Vorkath is already at 48 KC");
    expect(line).not.toContain("vorkath");
  });

  it("does not fall back to a raw slug for a boss it has never heard of", () => {
    const copy = recommendationDecisionCopy(
      build({
        winner: recommendation({
          id: "kc:some-new-boss:50",
          title: "Push Some New Boss to 50 KC",
          bossSlug: "some-new-boss"
        })
      }),
      { hasBank: true, hasRuneLite: true }
    );
    const line = `${copy.why} ${copy.sourceLine ?? ""}`;
    expect(line).not.toContain("some-new-boss");
  });
});

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
    expect(decision.unknowns.map((unknown) => unknown.code)).toEqual(["public_progress", "bank_setup", "runelite_completion"]);
    expect(decision.completion.mode).toBe("manual");
    expect(decision.fallback).toMatchObject({ used: true, missing: ["public_progress", "bank_setup", "runelite_completion"] });
  });

  it("does not present exact inventory claims without a bank", () => {
    const decision = build({ hasBank: false, hasRuneLite: false });
    const copy = recommendationDecisionCopy(decision);

    expect(decision.setup.required).toEqual([]);
    expect(copy.requiredSetup).toEqual([]);
    expect(JSON.stringify(copy)).not.toContain("12 sharks");
    expect(copy.firstStep).toContain("Check your gear, food and teleport first");
    expect(decision.setup.optional).toContainEqual({
      item: "Add bank to choose gear and supplies",
      provenance: "preference"
    });
  });

  it("keeps an unscanned diary requirement as a check instead of a confirmed blocker", () => {
    const decision = build({
      winner: recommendation({
        id: "diary:karamja:hard",
        kind: "diary",
        title: "Finish Karamja Hard",
        bossSlug: undefined,
        kcMeta: undefined,
        needs: ["Complete the final diary task"]
      }),
      hasRuneLite: false
    });

    expect(decision.setup.required).toEqual([]);
    expect(decision.firstStep.label).toBe("Check the next unfinished requirement first, then complete one step.");
    expect(recommendationDecisionCopy(decision).requiredSetup).toEqual([]);
  });

  it("does not offer a bank for a route whose method is unchanged by it", () => {
    const decision = build({
      winner: recommendation({
        id: "skill:agility",
        kind: "skill",
        title: "Run one Agility level",
        bossSlug: undefined,
        kcMeta: undefined,
        needs: undefined
      }),
      hasBank: false,
      hasRuneLite: false
    });

    expect(decision.unknowns.map((unknown) => unknown.code)).not.toContain("bank_setup");
    expect(decision.setup.optional.map((item) => item.item)).not.toContain("Add bank to choose gear and supplies");
  });

  it("keeps internal honesty terminology out of player copy", () => {
    // The VALUES, not the keys. This used to stringify the whole object, so it
    // fired the moment the copy gained a `confidence` field — a field name a
    // player never sees. Checking what renders is the point; checking the
    // shape of the object was an accident of how it was written.
    // Every string this module can put in front of a player, not just the ones
    // one fixture happens to produce. The first version of this looked at a
    // single `build()` and therefore never saw the source lines at all —
    // proven by pasting "Confidence payload data quality" into one of them and
    // watching the suite stay green.
    const copies = [
      recommendationDecisionCopy(build()),
      // No bank, no RuneLite: the two states that carry a source line.
      recommendationDecisionCopy(build({ hasBank: false, hasRuneLite: false })),
      recommendationDecisionCopy(build({ hasBank: false, hasRuneLite: false, hasPublicStats: false }))
    ];
    const playerCopy = copies
      .flatMap((copy) => Object.values(copy).flat())
      .filter((value) => typeof value === "string")
      .join(" ")
      .toLowerCase();

    expect(playerCopy).not.toContain("confidence");
    expect(playerCopy).not.toContain("data quality");
    expect(playerCopy).not.toContain("honesty level");
    expect(playerCopy).not.toContain("payload");
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
