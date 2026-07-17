import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pickForRoute, recommendationDiversityFamily } from "@/lib/mood";
import type { Recommendation } from "@/lib/next-up";
import type { RecommendationPreferenceProfile } from "@/lib/recommendation-preferences";

function candidate(
  id: string,
  kind: Recommendation["kind"],
  score: number,
  overrides: Partial<Recommendation> = {}
): Recommendation {
  const active = kind === "boss" || kind === "kc" || kind === "slayer";
  return {
    id,
    kind,
    title: id,
    why: "Account-specific golden scenario.",
    score,
    sessionProfile: {
      intensity: active ? "moderate" : "low",
      attention: active ? "active" : "low",
      setupMinutes: active ? 6 : 2,
      minimumMinutes: active ? 45 : 15,
      resetCost: "low",
      deathCost: "none",
      setupConfidence: active ? "verified" : "not-needed",
      prerequisiteDepth: "none",
      unlockValue: kind === "quest" || kind === "diary" || kind === "goal" ? 0.9 : 0.5
    },
    ...overrides
  };
}

describe("opportunity-cost recommendation ranking", () => {
  it("promotes a confirmed active Slayer task over a close generic trip", () => {
    const activeTask = candidate("slayer:current-task:abyssal-demon", "slayer", 92, {
      routeTags: ["slayer", "pvm"],
      slayerDecision: {} as NonNullable<Recommendation["slayerDecision"]>
    });
    const genericBoss = candidate("boss:generic", "boss", 88);

    const pick = pickForRoute([genericBoss, activeTask], "bossing", 60, "smart")!;

    expect(pick.headline.id).toBe(activeTask.id);
    expect(pick.rankingTrace.winner.strongestReasons).toContain("active_slayer_task");
  });

  it("keeps 1-4 KC scouting below established account commitment", () => {
    const scout = candidate("kc:callisto:50", "kc", 110, {
      kcMeta: { kc: 1, denom: 2_000, dropName: "Tyrannical ring" }
    });
    const established = candidate("kc:vorkath:50", "kc", 82, {
      kcMeta: { kc: 48, denom: 5_000, dropName: "Vorkath's skeletal visage" }
    });

    const pick = pickForRoute([scout, established], "bossing", 60, "boss-log")!;

    expect(pick.headline.id).toBe(established.id);
    const scoutTrace = pick.rankingTrace.candidates.find((entry) => entry.id === scout.id);
    expect(scoutTrace?.contributions).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "scout_kc", points: expect.any(Number) })
    ]));
    expect(pick.rankingTrace.runnerUp?.lostBecause).toContain("scout_kc");
  });

  it("hard-gates a long prerequisite chain out of a short session", () => {
    const longQuest = candidate("quest:long-chain", "quest", 120, {
      routeTags: ["unlock"],
      sessionProfile: { prerequisiteDepth: "long", minimumMinutes: 120 }
    });
    const quickDiary = candidate("diary:one-step", "diary", 64, {
      routeTags: ["unlock"],
      sessionProfile: { unlockValue: 0.9, minimumMinutes: 15, setupMinutes: 2 }
    });

    const pick = pickForRoute([longQuest, quickDiary], "short", 15, "short-login")!;
    const rejected = pick.rankingTrace.candidates.find((entry) => entry.id === longQuest.id);

    expect(pick.headline.id).toBe(quickDiary.id);
    expect(rejected).toMatchObject({ eligible: false });
    expect(rejected?.hardViolations).toEqual(expect.arrayContaining(["timebox", "long-prerequisites"]));
  });

  it("uses learned preference only to settle a close valid decision", () => {
    const profile: RecommendationPreferenceProfile = {
      familyScores: { bank: 0, bossing: 2, minigame: 0, money: 0, skilling: 0, slayer: 0, unlock: 0 },
      attentionScores: { "low-pressure": 0, active: 0 },
      timeboxScores: { short: 0, standard: 0, long: 0 },
      wildernessScore: 0,
      evidenceCount: 3
    };
    const boss = candidate("boss:vardorvis", "boss", 70);
    const task = candidate("slayer:generic", "slayer", 100, { routeTags: ["pvm"] });

    expect(pickForRoute([boss, task], "bossing", 60, "smart")?.headline.id).toBe(task.id);
    const learned = pickForRoute([boss, task], "bossing", 60, "smart", 0, { preferenceProfile: profile })!;
    expect(learned.headline.id).toBe(boss.id);
    expect(learned.rankingTrace.winner.strongestReasons).toContain("learned_preference");
  });

  it("keeps an unfinished accepted route ahead of a marginally stronger new idea", () => {
    const started = candidate("skill:cooking:next-level", "skill", 70, {
      why: "One level from the next useful Cooking stop.",
      routeTags: ["afk", "maxing"],
      sessionProfile: { attention: "afk", idleWindowSeconds: 30, minimumMinutes: 30 }
    });
    const newIdea = candidate("skill:fishing:next-level", "skill", 82, {
      routeTags: ["afk"],
      sessionProfile: { attention: "afk", idleWindowSeconds: 30, minimumMinutes: 30 }
    });

    const pick = pickForRoute([newIdea, started], "afk", 60, "smart", 0, { acceptedIds: [started.id] })!;

    expect(pick.headline.id).toBe(started.id);
    expect(pick.rankingTrace.winner.strongestReasons).toContain("accepted_route_progress");
  });

  it("excludes a recently rejected identity and chooses materially different backups", () => {
    const pool = [
      candidate("skill:afk", "skill", 95, { sessionProfile: { attention: "afk", idleWindowSeconds: 30 } }),
      candidate("money:herbs", "money", 86, { sessionProfile: { expectedProfit: "positive", profitEvidence: "account" } }),
      candidate("diary:hard", "diary", 82, { routeTags: ["unlock"] }),
      candidate("minigame:tempoross", "minigame", 78)
    ];
    const pick = pickForRoute(pool, "chill", 60, "smart", 0, { excludedIds: [pool[0].id] })!;
    const families = [pick.headline, ...pick.alternatives].map(recommendationDiversityFamily);

    expect(pick.headline.id).not.toBe(pool[0].id);
    expect(new Set(families).size).toBe(3);
    expect(pick.rankingTrace.candidates.find((entry) => entry.id === pool[0].id)?.hardViolations)
      .toContain("recently-rejected");
  });

  it("keeps the structured ranking trace out of player-facing /next rendering", () => {
    const source = readFileSync("src/app/next/next-client.tsx", "utf8");
    expect(source).not.toContain("rankingTrace");
  });
});
