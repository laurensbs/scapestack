import { describe, expect, it } from "vitest";
import { syncCompletesStartedRecommendation } from "@/lib/sync-trip-completion";
import type { RecommendationMemoryEntry } from "@/lib/recommendation-feedback";
import type { SyncDeltaSummary } from "@/lib/sync-repo";

const startedAt = Date.parse("2026-07-15T10:00:00.000Z");

describe("RuneLite trip completion evidence", () => {
  it("confirms an exact quest completion after the trip started", () => {
    expect(syncCompletesStartedRecommendation(
      started("quest:monkey-madness-ii", "Finish Monkey Madness II"),
      summary({ questsCompleted: ["Monkey Madness II"] }),
      "2026-07-15T11:00:00.000Z"
    )).toBe(true);
  });

  it("confirms exact diary and reached skill targets", () => {
    expect(syncCompletesStartedRecommendation(
      started("diary:Karamja:Hard", "Finish Karamja Hard diary"),
      summary({ diariesCompleted: [{ region: "Karamja", tier: "Hard" }] }),
      "2026-07-15T11:00:00.000Z"
    )).toBe(true);
    expect(syncCompletesStartedRecommendation(
      started("skill:cooking:99", "Push Cooking to 99"),
      summary({ skills: [{ name: "Cooking", previousLevel: 98, currentLevel: 99, xpGained: 210_000 }] }),
      "2026-07-15T11:00:00.000Z"
    )).toBe(true);
  });

  it("does not mistake unrelated XP, an old sync or an unreached target for completion", () => {
    const cooking = started("skill:cooking:99", "Push Cooking to 99");
    expect(syncCompletesStartedRecommendation(
      cooking,
      summary({ skills: [{ name: "Fishing", previousLevel: 80, currentLevel: 81, xpGained: 100_000 }] }),
      "2026-07-15T11:00:00.000Z"
    )).toBe(false);
    expect(syncCompletesStartedRecommendation(
      cooking,
      summary({ skills: [{ name: "Cooking", previousLevel: 97, currentLevel: 98, xpGained: 100_000 }] }),
      "2026-07-15T11:00:00.000Z"
    )).toBe(false);
    expect(syncCompletesStartedRecommendation(
      cooking,
      summary({ skills: [{ name: "Cooking", previousLevel: 98, currentLevel: 99, xpGained: 100_000 }] }),
      "2026-07-15T09:00:00.000Z"
    )).toBe(false);
  });
});

function started(id: string, title: string): RecommendationMemoryEntry {
  return { id, title, kind: id.split(":")[0], action: "started", savedAt: startedAt, mood: "focused", routeLens: "smart" };
}

function summary(overrides: Partial<SyncDeltaSummary>): SyncDeltaSummary {
  return {
    previousSyncedAt: "2026-07-15T09:00:00.000Z",
    questsCompleted: [],
    diariesCompleted: [],
    collectionLogItemIds: [],
    collectionLogItems: [],
    skills: [],
    bank: null,
    accountType: { previous: "normal", current: "normal", changed: false },
    ...overrides
  };
}
