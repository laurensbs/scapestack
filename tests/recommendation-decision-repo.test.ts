import { describe, expect, it, vi } from "vitest";
import { buildRecommendationDecision } from "@/lib/recommendation-decision";
import type { Recommendation } from "@/lib/next-up";

const database = vi.hoisted(() => ({
  query: vi.fn(async () => [{ decision_id: 44, created: false }])
}));

vi.mock("@/lib/db", () => ({
  sql: () => ({ query: database.query })
}));

import { recordRecommendationDecisionForAccount } from "@/lib/account-history-repo";

describe("RecommendationDecision repository", () => {
  it("persists the typed contract, links the latest snapshot and deduplicates render retries", async () => {
    const result = await recordRecommendationDecisionForAccount("account-1", decision());
    expect(result).toEqual({ decisionId: 44, created: false });

    const [query, params] = database.query.mock.calls.at(-1) as unknown as [string, unknown[]];
    expect(query).toContain("decision_key = $2");
    expect(query).toContain("INTERVAL '5 minutes'");
    expect(query).toContain("SELECT snapshot_id");
    expect(query).toContain("contract_version, decision");
    expect(params[0]).toBe("account-1");
    expect(params[1]).toMatch(/^decision:v1:/);
    expect(JSON.parse(String(params[4]))).toMatchObject({ version: 1, recommendationId: "skill:cooking:90" });
  });
});

function decision() {
  const winner: Recommendation = {
    id: "skill:cooking:90",
    kind: "skill",
    title: "Train Cooking to 90",
    why: "A clean next level.",
    score: 70,
    actionPlan: {
      timebox: "30 min",
      confidence: "likely",
      confidenceLabel: "Likely",
      prep: "Take raw fish from the bank.",
      steps: ["Cook one banked batch.", "Stop at level 90."]
    }
  };
  return buildRecommendationDecision({
    winner,
    alternatives: [],
    mood: "chill",
    routeFamily: "maxing",
    minutes: 30,
    accountStage: "midgame-main",
    accountType: "regular",
    hasPublicStats: true,
    hasBank: true,
    hasRuneLite: false
  });
}
