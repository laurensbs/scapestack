import { describe, expect, it } from "vitest";
import {
  pickForRoute,
  recommendationDiversityFamily,
  recommendationMoodEligibility,
  type RecommendationDiversityFamily
} from "@/lib/mood";
import type { Recommendation } from "@/lib/next-up";

function candidate(
  id: string,
  kind: Recommendation["kind"],
  score: number,
  overrides: Partial<Recommendation> = {}
): Recommendation {
  return {
    id,
    kind,
    title: id,
    why: "Account-specific fixture",
    score,
    sessionProfile: {
      intensity: kind === "skill" || kind === "bank" ? "low" : "moderate",
      attention: kind === "bank" ? "low" : "active",
      setupMinutes: 4,
      minimumMinutes: 20,
      idleWindowSeconds: 0,
      resetCost: "low",
      wilderness: false,
      raid: false,
      deathCost: "none",
      setupConfidence: "not-needed",
      expectedProfit: kind === "money" ? "positive" : "none",
      profitEvidence: kind === "money" ? "catalogue" : "none",
      unlockValue: kind === "diary" || kind === "goal" ? 0.9 : 0.55,
      prerequisiteDepth: "none"
    },
    ...overrides
  };
}

const CHILL_POOL: Recommendation[] = [
  candidate("skill:fishing", "skill", 88),
  candidate("diary:ardougne-hard", "diary", 84),
  candidate("money:herb-run", "money", 81),
  candidate("minigame:tempoross", "minigame", 78),
  candidate("bank:quick-prep", "bank", 74),
  candidate("goal:graceful", "goal", 72),
  candidate("kc:cox", "kc", 200, {
    bossSlug: "cox",
    sessionProfile: {
      intensity: "extreme",
      attention: "focused",
      raid: true,
      setupConfidence: "verified"
    }
  })
];

describe("constrained recommendation diversity", () => {
  it("keeps ten Chill rolls inside the hard mood contract", () => {
    const excludedIds: string[] = [];
    const recentFamilies: RecommendationDiversityFamily[] = [];

    for (let roll = 0; roll < 10; roll += 1) {
      const pick = pickForRoute(CHILL_POOL, "chill", 30, "smart", 0, {
        excludedIds,
        recentFamilies,
        seed: `chill:${roll}`
      });
      expect(pick).not.toBeNull();
      expect(recommendationMoodEligibility(pick!.headline, "chill", 30).eligible).toBe(true);
      expect(pick!.headline.id).not.toBe("kc:cox");
      excludedIds.push(pick!.headline.id);
      recentFamilies.push(recommendationDiversityFamily(pick!.headline));
    }
  });

  it("returns three distinct identities and families while alternatives exist", () => {
    const excludedIds: string[] = [];
    const recentFamilies: RecommendationDiversityFamily[] = [];
    const ids: string[] = [];
    const families: RecommendationDiversityFamily[] = [];

    for (let roll = 0; roll < 3; roll += 1) {
      const pick = pickForRoute(CHILL_POOL, "chill", 30, "smart", 0, {
        excludedIds,
        recentFamilies,
        seed: "stable-session"
      })!;
      const family = recommendationDiversityFamily(pick.headline);
      ids.push(pick.headline.id);
      families.push(family);
      excludedIds.push(pick.headline.id);
      recentFamilies.push(family);
    }

    expect(new Set(ids).size).toBe(3);
    expect(new Set(families).size).toBe(3);
  });

  it("is deterministic for the same seed and lets material account fit beat novelty", () => {
    const pool = [
      candidate("skill:best-fit", "skill", 100),
      candidate("bank:novel-but-weaker", "bank", 70),
      candidate("money:equal-a", "money", 60),
      candidate("minigame:equal-b", "minigame", 60)
    ];
    const options = { seed: "Lauky:chill:30:1" };

    const first = pickForRoute(pool, "chill", 30, "smart", 0, options);
    const second = pickForRoute(pool, "chill", 30, "smart", 0, options);

    expect(first?.headline.id).toBe("skill:best-fit");
    expect(second?.headline.id).toBe(first?.headline.id);
  });

  it("never promotes a known impossible boss even after repeated rolls", () => {
    const impossible = candidate("boss:missing-setup", "boss", 500, {
      sessionProfile: {
        intensity: "high",
        attention: "focused",
        setupConfidence: "unknown",
        minimumMinutes: 45
      }
    });
    const viable = [
      candidate("boss:vorkath", "boss", 90, { sessionProfile: { setupConfidence: "verified" } }),
      candidate("kc:vardorvis", "kc", 85, { sessionProfile: { setupConfidence: "verified" } }),
      candidate("slayer:dust-devils", "slayer", 80, {
        routeTags: ["pvm", "slayer"],
        sessionProfile: { setupConfidence: "guided" }
      })
    ];

    for (let roll = 0; roll < 10; roll += 1) {
      const pick = pickForRoute([impossible, ...viable], "bossing", 60, "boss-log", roll, {
        seed: `bossing:${roll}`
      });
      expect(pick?.headline.id).not.toBe(impossible.id);
    }
  });
});
