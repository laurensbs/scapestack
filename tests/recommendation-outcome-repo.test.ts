import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountSnapshotDelta } from "@/lib/account-snapshot-delta";
import { buildRecommendationDecision } from "@/lib/recommendation-decision";
import type { Recommendation } from "@/lib/next-up";

const database = vi.hoisted(() => ({
  activeRows: [] as Array<Record<string, unknown>>,
  insertRows: [] as Array<Record<string, unknown>>,
  calls: [] as Array<{ query: string; params: unknown[] }>,
  query: vi.fn(async (query: string, params: unknown[] = []) => {
    database.calls.push({ query, params });
    return query.includes("INSERT INTO outcome_match") ? database.insertRows.splice(0) : database.activeRows;
  })
}));

vi.mock("@/lib/db", () => ({ sql: () => ({ query: database.query }) }));

import { reconcileActiveRecommendationOutcomes } from "@/lib/recommendation-outcome-repo";

beforeEach(() => {
  database.activeRows = [{ decision_id: "18", decision: validDecision() }];
  database.insertRows = [{ outcome_id: "91" }];
  database.calls = [];
  database.query.mockClear();
});

describe("recommendation outcome repository", () => {
  it("loads only active exact starts and stores the result against snapshot plus decision", async () => {
    const outcomes = await reconcileActiveRecommendationOutcomes({
      rsn: " Lauky ",
      snapshotId: 7,
      delta: kcDelta(),
      capturedAt: "2026-07-16T12:00:00.000Z"
    });

    expect(outcomes).toEqual([
      expect.objectContaining({ outcomeId: 91, decisionId: 18, outcome: expect.objectContaining({ status: "completed" }) })
    ]);
    const select = database.calls[0];
    expect(select.query).toContain("lifecycle.event_type = 'started'");
    expect(select.query).toContain("outcome.status IN ('completed', 'contradicted')");
    expect(select.params).toEqual(["lauky", "2026-07-16T12:00:00.000Z"]);
    const insert = database.calls[1];
    expect(insert.query).toContain("ON CONFLICT (snapshot_id, decision_id)");
    expect(insert.params.slice(0, 7)).toEqual(["lauky", 7, 18, "boss:vorkath:50", "boss_kc_at_least", "completed", expect.stringContaining("outcome:v1")]);
  });

  it("returns no duplicate when the same snapshot and decision already have an outcome", async () => {
    database.insertRows = [];
    const outcomes = await reconcileActiveRecommendationOutcomes({
      rsn: "lauky",
      snapshotId: 7,
      delta: kcDelta(),
      capturedAt: "2026-07-16T12:00:00.000Z"
    });
    expect(outcomes).toEqual([]);
  });
});

function validDecision() {
  const winner: Recommendation = {
    id: "boss:vorkath:50",
    kind: "kc",
    bossSlug: "vorkath",
    title: "Push Vorkath to 50 KC",
    why: "Two KC is a clean finish.",
    score: 90,
    completionTarget: { kind: "boss_kc_at_least", boss: "Vorkath", target: 50 },
    actionPlan: {
      timebox: "60 min", confidence: "exact", confidenceLabel: "Exact",
      prep: "Gear for Vorkath.", steps: ["Gear for Vorkath.", "Stop at 50 KC."]
    }
  };
  return buildRecommendationDecision({
    winner, alternatives: [], mood: "bossing", routeFamily: "boss-log", minutes: 60,
    accountStage: "midgame-main", accountType: "regular", hasPublicStats: true,
    hasBank: true, hasRuneLite: true
  });
}

function kcDelta(): AccountSnapshotDelta {
  return {
    deltaId: "delta-kc", fromChecksum: "a", toChecksum: "b", kind: "changed",
    capturedAt: "2026-07-16T12:00:00.000Z", elapsedSeconds: 900, freshness: "fresh",
    availability: { skills: "available", quests: "available", diaries: "available", collectionLog: "available", bossKc: "available", slayer: "available", bank: "available" },
    totalXp: { status: "unchanged", movement: null }, skills: [],
    quests: { status: "unchanged", added: [], removed: [] },
    diaries: { status: "unchanged", added: [], removed: [] },
    collectionLog: { status: "unchanged", added: [], removed: [] },
    bossKc: [{ boss: "Vorkath", status: "changed", movement: { before: 48, after: 50, delta: 2, direction: "increase", confidence: "observed" } }],
    slayer: { status: "unchanged", taskId: { before: null, after: null, changed: false }, taskRemaining: null, points: null, streak: null },
    bank: { status: "unchanged", added: [], removed: [], quantityChanged: [], totalChangedItems: 0, truncated: false },
    facts: []
  };
}
