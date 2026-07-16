import { describe, expect, it } from "vitest";
import type { AccountSnapshotDelta } from "@/lib/account-snapshot-delta";
import { buildRecommendationDecision } from "@/lib/recommendation-decision";
import { reconcileRecommendationOutcome } from "@/lib/recommendation-outcome";
import type { Recommendation, RecommendationCompletionTarget, RecKind } from "@/lib/next-up";

function decision(target: RecommendationCompletionTarget, kind: RecKind = "kc", title = "Push Vorkath to 50 KC") {
  const winner: Recommendation = {
    id: `test:${target.kind}`,
    kind,
    title,
    why: "This is the clean next account step.",
    score: 90,
    completionTarget: target,
    actionPlan: {
      timebox: "60 min",
      confidence: "exact",
      confidenceLabel: "Exact",
      prep: "Start the route.",
      steps: ["Start the route.", "Stop at the target."]
    }
  };
  return buildRecommendationDecision({
    winner,
    alternatives: [],
    mood: "focused",
    routeFamily: "smart",
    minutes: 60,
    accountStage: "midgame-main",
    accountType: "regular",
    hasPublicStats: true,
    hasBank: true,
    hasRuneLite: true
  });
}

function movement(before: number, after: number) {
  const change = after - before;
  return {
    before,
    after,
    delta: change,
    direction: change > 0 ? "increase" as const : change < 0 ? "decrease" as const : "none" as const,
    confidence: change < 0 ? "source-regression" as const : "observed" as const
  };
}

function delta(overrides: Partial<AccountSnapshotDelta> = {}): AccountSnapshotDelta {
  return {
    deltaId: "delta-2",
    fromChecksum: "before",
    toChecksum: "after",
    kind: "changed",
    capturedAt: "2026-07-16T12:00:00.000Z",
    elapsedSeconds: 3600,
    freshness: "fresh",
    availability: {
      skills: "available",
      quests: "available",
      diaries: "available",
      collectionLog: "available",
      bossKc: "available",
      slayer: "available",
      bank: "available"
    },
    totalXp: { status: "unchanged", movement: movement(10_000, 10_000) },
    skills: [],
    quests: { status: "unchanged", added: [], removed: [] },
    diaries: { status: "unchanged", added: [], removed: [] },
    collectionLog: { status: "unchanged", added: [], removed: [] },
    bossKc: [],
    slayer: {
      status: "unchanged",
      taskId: { before: 0, after: 0, changed: false },
      taskRemaining: null,
      points: null,
      streak: null
    },
    bank: {
      status: "unchanged",
      added: [],
      removed: [],
      quantityChanged: [],
      totalChangedItems: 0,
      truncated: false
    },
    facts: [],
    ...overrides
  };
}

describe("recommendation outcome engine", () => {
  it("completes the exact 48 to 50 KC target", () => {
    const result = reconcileRecommendationOutcome({
      decision: decision({ kind: "boss_kc_at_least", boss: "Vorkath", target: 50 }),
      delta: delta({ bossKc: [{ boss: "Vorkath", status: "changed", movement: movement(48, 50) }] })
    });
    expect(result).toMatchObject({ status: "completed", terminal: true, progress: { before: 48, after: 50, remaining: 0 } });
  });

  it("keeps partial KC progress active and changes the next stop point", () => {
    const result = reconcileRecommendationOutcome({
      decision: decision({ kind: "boss_kc_at_least", boss: "Vorkath", target: 50 }),
      delta: delta({ bossKc: [{ boss: "Vorkath", status: "changed", movement: movement(48, 49) }] })
    });
    expect(result).toMatchObject({ status: "progressed", terminal: false, progress: { remaining: 1 } });
    expect(result.nextStopPoint).toBe("1 KC left to the target.");
  });

  it("does not complete Cooking from unrelated Fishing XP", () => {
    const result = reconcileRecommendationOutcome({
      decision: decision({ kind: "skill_level_at_least", skill: "Cooking", target: 99 }, "skill", "Reach 99 Cooking"),
      delta: delta({
        skills: [{ name: "Fishing", status: "changed", level: movement(90, 90), xp: movement(5_000_000, 5_100_000) }]
      })
    });
    expect(result.status).toBe("unchanged");
  });

  it("counts relevant XP as partial skill progress without inventing a level-up", () => {
    const result = reconcileRecommendationOutcome({
      decision: decision({ kind: "skill_level_at_least", skill: "Cooking", target: 99 }, "skill", "Reach 99 Cooking"),
      delta: delta({
        skills: [{ name: "Cooking", status: "changed", level: movement(98, 98), xp: movement(12_000_000, 12_250_000) }]
      })
    });
    expect(result).toMatchObject({ status: "progressed", terminal: false, progress: { remaining: 1, unit: "level" } });
    expect(result.detail).toContain("250,000 Cooking XP");
  });

  it("completes exact levels, quests, diaries and collection log drops", () => {
    const level = reconcileRecommendationOutcome({
      decision: decision({ kind: "skill_level_at_least", skill: "Cooking", target: 99 }, "skill", "Reach 99 Cooking"),
      delta: delta({ skills: [{ name: "Cooking", status: "changed", level: movement(98, 99), xp: movement(12_000_000, 13_034_431) }] })
    });
    const quest = reconcileRecommendationOutcome({
      decision: decision({ kind: "quest_completed", quest: "Dragon Slayer II" }, "quest", "Complete Dragon Slayer II"),
      delta: delta({ quests: { status: "changed", added: ["Dragon Slayer II"], removed: [] } })
    });
    const diary = reconcileRecommendationOutcome({
      decision: decision({ kind: "diary_completed", region: "Karamja", tier: "Elite" }, "diary", "Finish Karamja Elite"),
      delta: delta({ diaries: { status: "changed", added: [{ region: "Karamja", tier: "Elite" }], removed: [] } })
    });
    const clog = reconcileRecommendationOutcome({
      decision: decision({ kind: "collection_log_item_obtained", item: "Vorkath's head", itemId: 21907 }, "kc", "Get Vorkath's head"),
      delta: delta({ collectionLog: { status: "changed", added: [21907], removed: [] } })
    });
    expect([level.status, quest.status, diary.status, clog.status]).toEqual(["completed", "completed", "completed", "completed"]);
  });

  it("tracks Slayer progress but distrusts an unexplained task change", () => {
    const target = { kind: "slayer_task_finished", taskId: 42, taskName: "Dust devils", startingRemaining: 80 } as const;
    const progressed = reconcileRecommendationOutcome({
      decision: decision(target, "slayer", "Finish your Dust devil task"),
      delta: delta({
        slayer: {
          status: "changed",
          taskId: { before: 42, after: 42, changed: false },
          taskRemaining: { ...movement(80, 35), confidence: "observed" },
          points: movement(100, 100),
          streak: movement(10, 10)
        }
      })
    });
    const contradicted = reconcileRecommendationOutcome({
      decision: decision(target, "slayer", "Finish your Dust devil task"),
      delta: delta({
        slayer: {
          status: "changed",
          taskId: { before: 42, after: 55, changed: true },
          taskRemaining: { ...movement(80, 120), confidence: "observed" },
          points: movement(100, 100),
          streak: movement(10, 10)
        }
      })
    });
    expect(progressed).toMatchObject({ status: "progressed", progress: { remaining: 35 } });
    expect(contradicted.status).toBe("contradicted");
  });

  it("tracks acquired bank quantities and never guesses when a source is missing", () => {
    const acquired = reconcileRecommendationOutcome({
      decision: decision({ kind: "bank_quantity_at_least", item: "Raw shark", itemId: 383, target: 100 }, "bank", "Get 100 raw sharks"),
      delta: delta({
        bank: {
          status: "changed",
          added: [{ id: 383, name: "Raw shark", beforeQuantity: 0, afterQuantity: 100, delta: 100 }],
          removed: [], quantityChanged: [], totalChangedItems: 1, truncated: false
        }
      })
    });
    const unknown = reconcileRecommendationOutcome({
      decision: decision({ kind: "boss_kc_at_least", boss: "Vorkath", target: 50 }),
      delta: delta({ availability: { ...delta().availability, bossKc: "unknown" } })
    });
    expect(acquired.status).toBe("completed");
    expect(unknown.status).toBe("unknown");
  });

  it("marks regressions as contradicted rather than completion", () => {
    const result = reconcileRecommendationOutcome({
      decision: decision({ kind: "boss_kc_at_least", boss: "Vorkath", target: 50 }),
      delta: delta({ bossKc: [{ boss: "Vorkath", status: "regressed", movement: movement(48, 40) }] })
    });
    expect(result).toMatchObject({ status: "contradicted", terminal: true });
  });
});
