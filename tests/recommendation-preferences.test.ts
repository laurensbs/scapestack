import { describe, expect, it } from "vitest";
import { pickForRoute } from "@/lib/mood";
import type { Recommendation } from "@/lib/next-up";
import type { RecommendationFeedback, RecommendationMemoryEntry } from "@/lib/recommendation-feedback";
import {
  buildRecommendationPreferenceProfile,
  recommendationPreferenceMultiplier
} from "@/lib/recommendation-preferences";

const NOW = Date.parse("2026-07-16T12:00:00.000Z");

function memory(
  id: string,
  kind: string,
  action: RecommendationMemoryEntry["action"],
  savedAt = NOW
): RecommendationMemoryEntry {
  return { id, kind, action, savedAt, rsnKey: "lauky" };
}

function feedback(recent: RecommendationMemoryEntry[]): RecommendationFeedback {
  return { version: 1, suppressed: {}, recent };
}

function rec(kind: Recommendation["kind"], id: string, score: number): Recommendation {
  return {
    id,
    kind,
    title: id,
    why: "Account-fit test route.",
    score,
    sessionProfile: kind === "boss"
      ? { setupConfidence: "verified" }
      : undefined
  };
}

describe("decaying recommendation preferences", () => {
  it("lets repeated bossing completions influence a close bossing decision", () => {
    const profile = buildRecommendationPreferenceProfile(feedback([
      memory("boss:vorkath", "boss", "completed_runelite"),
      memory("boss:zulrah", "boss", "completed_runelite"),
      memory("kc:muspah", "kc", "completed_manual")
    ]), { rsn: "Lauky", now: NOW });
    const recs: Recommendation[] = [
      rec("boss", "boss:vardorvis", 48),
      {
        ...rec("slayer", "slayer:task", 80),
        routeTags: ["pvm", "slayer"],
        sessionProfile: { setupConfidence: "guided" }
      }
    ];

    expect(pickForRoute(recs, "bossing", 60, "smart")?.headline.id).toBe("slayer:task");
    expect(pickForRoute(recs, "bossing", 60, "smart", 0, { preferenceProfile: profile })?.headline.id)
      .toBe("boss:vardorvis");
  });

  it("keeps one accidental skip deliberately small", () => {
    const profile = buildRecommendationPreferenceProfile(feedback([
      memory("boss:vorkath", "boss", "not_today")
    ]), { rsn: "Lauky", now: NOW });

    expect(recommendationPreferenceMultiplier(profile, rec("boss", "boss:zulrah", 50), 60))
      .toBeGreaterThan(0.98);
  });

  it("never lets learned bossing preference override a Chill hard gate", () => {
    const profile = buildRecommendationPreferenceProfile(feedback([
      memory("boss:vorkath", "boss", "completed_runelite"),
      memory("boss:zulrah", "boss", "completed_runelite"),
      memory("boss:muspah", "boss", "completed_runelite")
    ]), { rsn: "Lauky", now: NOW });
    const result = pickForRoute([
      rec("boss", "boss:chambers", 500),
      { ...rec("skill", "skill:fishing", 35), sessionProfile: { attention: "afk", idleWindowSeconds: 30 } }
    ], "chill", 60, "smart", 0, { preferenceProfile: profile });

    expect(result?.headline.id).toBe("skill:fishing");
  });

  it("decays old completion evidence and isolates accounts", () => {
    const old = NOW - 42 * 24 * 60 * 60 * 1000;
    const current = buildRecommendationPreferenceProfile(feedback([
      memory("boss:vorkath", "boss", "completed_runelite")
    ]), { rsn: "Lauky", now: NOW });
    const decayed = buildRecommendationPreferenceProfile(feedback([
      memory("boss:vorkath", "boss", "completed_runelite", old)
    ]), { rsn: "Lauky", now: NOW });
    const otherAccount = buildRecommendationPreferenceProfile(feedback([
      memory("boss:vorkath", "boss", "completed_runelite")
    ]), { rsn: "Other", now: NOW });

    expect(decayed.familyScores.bossing).toBeLessThan(current.familyScores.bossing);
    expect(otherAccount.evidenceCount).toBe(0);
  });
});
