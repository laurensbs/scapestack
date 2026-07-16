import { describe, expect, it, vi } from "vitest";
import { buildRecommendationDecision } from "@/lib/recommendation-decision";
import type { Recommendation } from "@/lib/next-up";

const database = vi.hoisted(() => ({
  query: vi.fn(async (query: string) => query.includes("trip_lifecycle_event")
    ? [{ event_id: 45, created: true }]
    : [{ decision_id: 44, created: false }])
}));

vi.mock("@/lib/db", () => ({
  sql: () => ({ query: database.query })
}));

import {
  recordRecommendationDecisionForAccount,
  recordRecommendationLifecycleForAccount
} from "@/lib/account-history-repo";

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

  it("deduplicates only repeated adjacent actions and preserves real lifecycle transitions", async () => {
    const exactDecision = decision();
    const result = await recordRecommendationLifecycleForAccount({
      accountId: "account-1",
      decisionId: 44,
      decision: exactDecision,
      eventType: "started"
    });
    expect(result).toEqual({ eventId: 45, created: true });
    const [query] = database.query.mock.calls.at(-1) as unknown as [string, unknown[]];
    expect(query).toContain("ORDER BY occurred_at DESC, event_id DESC");
    expect(query).toContain("event_type = $4 AND occurred_at > NOW() - INTERVAL '5 seconds'");
    expect(query).not.toContain("ON CONFLICT (account_id, decision_id, event_type)");
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
