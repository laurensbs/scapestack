import { describe, expect, it } from "vitest";
import {
  assessRecommendationHonesty,
  recommendationBankWouldChangePlan
} from "@/lib/recommendation-honesty";
import { pickForRoute } from "@/lib/mood";
import type { Recommendation } from "@/lib/next-up";

function recommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: "skill:agility",
    kind: "skill",
    title: "Run one Agility level",
    why: "This is the closest useful level.",
    score: 80,
    routeTags: ["maxing"],
    ...overrides
  };
}

describe("recommendation honesty", () => {
  it("turns a no-bank boss assumption into a conservative first check", () => {
    const assessment = assessRecommendationHonesty(
      recommendation({
        id: "kc:vorkath:50",
        kind: "kc",
        title: "Push Vorkath to 50 KC",
        bossSlug: "vorkath",
        needs: ["12 sharks", "Ranged gear"],
        gearConfidence: "unknown"
      }),
      { hasPublicStats: true, hasBank: false, hasRuneLite: false }
    );

    expect(assessment).toMatchObject({
      level: "insufficient",
      bankWouldChangePlan: true,
      canUseSetupClaims: false,
      invalidatingUnknowns: ["setup"]
    });
    expect(assessment.firstCheck).toContain("Check your gear, food and teleport first");
  });

  it("does not ask for a bank when it cannot materially change the route", () => {
    expect(recommendationBankWouldChangePlan(recommendation())).toBe(false);
    expect(recommendationBankWouldChangePlan(recommendation({ kind: "minigame", title: "Play one Tempoross game" }))).toBe(false);
  });

  it("treats diary requirements as unfinished checks without RuneLite", () => {
    const assessment = assessRecommendationHonesty(
      recommendation({
        id: "diary:karamja:hard",
        kind: "diary",
        title: "Finish Karamja Hard",
        needs: ["Complete the remaining diary task"]
      }),
      { hasPublicStats: true, hasBank: true, hasRuneLite: false }
    );

    expect(assessment.level).toBe("estimated");
    expect(assessment.canUseSetupClaims).toBe(false);
    expect(assessment.firstCheck).toBe("Check the next unfinished requirement first, then complete one step.");
  });

  it("lets an equally useful verified route beat a supply-dependent estimate", () => {
    const verified = recommendation({ id: "skill:agility", title: "Run one Agility level" });
    const estimated = recommendation({
      id: "skill:cooking",
      title: "Cook one level",
      needs: ["Raw fish from your bank"]
    });

    const pick = pickForRoute([estimated, verified], "unlock", 60, "maxing", 0, {
      honestyContext: { hasPublicStats: true, hasBank: false, hasRuneLite: true },
      seed: "honesty-contract"
    });

    expect(assessRecommendationHonesty(verified, { hasPublicStats: true, hasBank: false, hasRuneLite: true }).level).toBe("verified");
    expect(assessRecommendationHonesty(estimated, { hasPublicStats: true, hasBank: false, hasRuneLite: true }).level).toBe("estimated");
    expect(pick?.headline.id).toBe(verified.id);
  });
});
