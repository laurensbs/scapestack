import { describe, expect, it } from "vitest";
import { runeliteProgressFromSyncSummary } from "@/lib/runelite-progress-memory";

describe("RuneLite progress memory", () => {
  it("turns sync deltas into compact return lines", () => {
    const progress = runeliteProgressFromSyncSummary({
      previousSyncedAt: "2026-07-15T10:10:00.000Z",
      questsCompleted: ["Dragon Slayer II"],
      diariesCompleted: [{ region: "Karamja", tier: "Hard" }],
      collectionLogItemIds: [11286],
      collectionLogItems: [{ id: 11286, name: "Draconic visage" }],
      skills: [{ name: "Cooking", previousLevel: 97, currentLevel: 98, xpGained: 450_000 }],
      bank: {
        previousItemCount: 1,
        currentItemCount: 778,
        previousUnavailableReason: null,
        currentUnavailableReason: null,
        enabledChanged: false,
        itemCountChanged: true,
        statusChanged: false
      },
      accountType: { previous: "normal", current: "normal", changed: false }
    }, {
      syncedAt: "2026-07-15T11:00:00.000Z",
      headlineTitle: "Pick a maxing lane: Cooking",
      savedAt: 1_780_000_000_000
    });

    expect(progress).toMatchObject({
      title: "Finished steps are gone",
      lead: "Pick a maxing lane: Cooking is checked against the latest scan.",
      syncedAt: "2026-07-15T11:00:00.000Z",
      savedAt: 1_780_000_000_000
    });
    expect(progress?.lines).toEqual([
      "Cooking 97->98: +450k XP",
      "Dragon Slayer II finished",
      "Karamja Hard finished",
      "Draconic visage added"
    ]);
  });

  it("returns null when there is no actual movement", () => {
    expect(runeliteProgressFromSyncSummary(null)).toBeNull();
  });
});
