import { describe, expect, it } from "vitest";
import {
  pickForRoute,
  recommendationMoodEligibility,
  type Mood,
  type TimeBudget
} from "@/lib/mood";
import type { RecKind, Recommendation } from "@/lib/next-up";
import type { RecommendationSessionProfile } from "@/lib/recommendation-session";

const KINDS: RecKind[] = [
  "goal", "quest", "diary", "boss", "kc", "minigame",
  "money", "slayer", "skill", "bank", "milestone"
];
const MOODS: Mood[] = ["chill", "focused", "cash", "quest", "bossing", "unlock", "afk", "short"];

const EXPECTED: Record<Mood, RecKind[]> = {
  chill: ["goal", "diary", "minigame", "money", "slayer", "skill", "bank", "milestone"],
  focused: ["boss", "kc", "slayer"],
  cash: ["boss", "kc", "money"],
  quest: ["goal", "quest", "diary", "slayer", "skill", "milestone"],
  bossing: ["boss", "kc", "slayer"],
  unlock: ["goal", "quest", "diary", "slayer", "skill", "milestone"],
  afk: ["skill"],
  short: ["money", "slayer", "skill", "bank"]
};

function profileFor(kind: RecKind): RecommendationSessionProfile {
  const base: RecommendationSessionProfile = {
    intensity: "moderate",
    attention: "active",
    setupMinutes: 4,
    minimumMinutes: 20,
    idleWindowSeconds: 0,
    resetCost: "low",
    wilderness: false,
    raid: false,
    deathCost: "none",
    setupConfidence: "not-needed",
    expectedProfit: "none",
    profitEvidence: "none",
    unlockValue: 0.5,
    prerequisiteDepth: "none"
  };
  if (kind === "quest") return { ...base, attention: "focused", minimumMinutes: 60, unlockValue: 0.9 };
  if (kind === "goal" || kind === "diary" || kind === "milestone") return { ...base, unlockValue: 0.9 };
  if (kind === "boss" || kind === "kc") {
    return {
      ...base,
      intensity: "high",
      attention: "focused",
      minimumMinutes: 45,
      resetCost: "moderate",
      deathCost: "moderate",
      setupConfidence: "verified",
      expectedProfit: "positive",
      profitEvidence: "catalogue"
    };
  }
  if (kind === "money") {
    return { ...base, minimumMinutes: 10, expectedProfit: "positive", profitEvidence: "catalogue" };
  }
  if (kind === "slayer") return { ...base, minimumMinutes: 10, setupConfidence: "guided", unlockValue: 0.72 };
  if (kind === "skill") {
    return { ...base, intensity: "low", attention: "afk", minimumMinutes: 15, idleWindowSeconds: 30, unlockValue: 0.75 };
  }
  if (kind === "bank") return { ...base, intensity: "low", attention: "low", minimumMinutes: 5 };
  return base;
}

function candidate(kind: RecKind, overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: `contract:${kind}`,
    kind,
    title: `Test ${kind}`,
    why: "Contract fixture",
    score: 80,
    routeTags: kind === "slayer" ? ["slayer", "pvm", "unlock"] : kind === "skill" ? ["afk", "maxing"] : undefined,
    sessionProfile: profileFor(kind),
    ...overrides
  };
}

describe("hard mood contracts", () => {
  it.each(MOODS)("enumerates every candidate family for %s", (mood) => {
    const minutes: TimeBudget = mood === "short" ? 15 : 60;
    const eligible = KINDS.filter((kind) => recommendationMoodEligibility(candidate(kind), mood, minutes).eligible);
    expect(eligible).toEqual(EXPECTED[mood]);
  });

  it("does not let a route lens force Chambers of Xeric into Chill", () => {
    const raid = candidate("kc", {
      id: "kc:Chambers of Xeric",
      title: "Run Chambers of Xeric",
      bossSlug: "cox",
      sessionProfile: { ...profileFor("kc"), raid: true, intensity: "extreme" }
    });
    const fishing = candidate("skill", { id: "skill:Fishing", title: "Fish karambwans" });
    const result = pickForRoute([raid, fishing], "chill", 60, "boss-log");
    expect(result?.headline.id).toBe("skill:Fishing");
    expect(result?.alternatives.some((rec) => rec.id === raid.id)).toBe(false);
  });

  it("does not let active Vardorvis into AFK", () => {
    const vardorvis = candidate("kc", {
      id: "kc:Vardorvis:first-50",
      title: "Push Vardorvis to 50 KC",
      bossSlug: "vardorvis"
    });
    const woodcutting = candidate("skill", { id: "skill:Woodcutting", title: "Cut redwoods" });
    const result = pickForRoute([vardorvis, woodcutting], "afk", 60, "boss-log");
    expect(result?.headline.id).toBe("skill:Woodcutting");
    expect(result?.alternatives).toEqual([]);
  });

  it("rejects a multi-hour prerequisite chain for Short", () => {
    const quest = candidate("quest", {
      id: "quest:long-chain",
      title: "Start a Grandmaster quest",
      sessionProfile: {
        ...profileFor("quest"),
        minimumMinutes: 120,
        prerequisiteDepth: "long",
        resetCost: "high"
      }
    });
    const bank = candidate("bank", { id: "bank:quick" });
    const result = pickForRoute([quest, bank], "short", 15, "unlock-chain");
    expect(result?.headline.id).toBe("bank:quick");
    expect(recommendationMoodEligibility(quest, "short", 15).violations).toContain("long-prerequisites");
  });
});
