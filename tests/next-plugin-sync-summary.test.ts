import { describe, expect, it, vi } from "vitest";
import { summarizeNextPluginSync } from "@/lib/next-plugin-sync-summary";
import { CURRENT_PLUGIN_VERSION } from "@/lib/plugin-sync";

const basePlugin = {
  syncedAt: "2026-06-03T11:30:00.000Z",
  quests: 12,
  diaries: 8,
  clItems: 44,
  bankStatus: { enabled: true, itemCount: 612, capturedAt: "2026-06-03T11:30:00.000Z", unavailableReason: null },
  pluginVersion: CURRENT_PLUGIN_VERSION,
  slayerTaskRemaining: 47,
  slayerBlocks: 2
};

describe("next plugin sync summary", () => {
  it("marks all plugin signals ready when live sync is complete", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00.000Z"));

    const summary = summarizeNextPluginSync(basePlugin);

    expect(summary.state).toBe("live");
    expect(summary.title).toBe("RuneLite is helping your next trip");
    expect(summary.body).toContain("Last scan:");
    expect(summary.body).toContain("Skips finished quests, diary tiers, clog slots and Slayer");
    expect(summary.body).not.toContain("payload");
    expect(summary.body).not.toContain("coverage");
    expect(summary.signals.map((signal) => [signal.label, signal.status])).toEqual([
      ["Quests", "exact"],
      ["Diaries", "exact"],
      ["Bank", "exact"],
      ["CL", "exact"],
      ["Slayer", "exact"]
    ]);

    vi.useRealTimers();
  });

  it("does not overstate Slayer or collection log when those fields are missing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00.000Z"));

    const summary = summarizeNextPluginSync({
      ...basePlugin,
      clItems: 0,
      slayerTaskRemaining: null,
      slayerBlocks: 0
    });

    expect(summary.title).toBe("RuneLite is helping your next trip");
    expect(summary.body).toContain("Skips finished quests and diaries");
    expect(summary.body).toContain("no live Slayer task yet");
    expect(summary.body).not.toContain("payload");
    expect(summary.body).not.toContain("exact from RuneLite");
    expect(summary.signals.find((signal) => signal.label === "CL")?.status).toBe("partial");
    expect(summary.signals.find((signal) => signal.label === "Bank")?.status).toBe("exact");
    expect(summary.signals.find((signal) => signal.label === "Slayer")?.status).toBe("missing");

    vi.useRealTimers();
  });

  it("marks stale and outdated sync as refresh or update before using details", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T12:00:00.000Z"));

    expect(summarizeNextPluginSync(basePlugin).signals.every((signal) => signal.status === "refresh")).toBe(true);
    expect(summarizeNextPluginSync({
      ...basePlugin,
      pluginVersion: "0.1.0"
    }).signals.every((signal) => signal.status === "update")).toBe(true);

    vi.useRealTimers();
  });

  it("turns sync deltas into compact account-memory lines", () => {
    const summary = summarizeNextPluginSync({
      ...basePlugin,
      lastSyncSummary: {
        previousSyncedAt: "2026-06-03T10:30:00.000Z",
        questsCompleted: ["Dragon Slayer II"],
        diariesCompleted: [{ region: "Karamja", tier: "Hard" }],
        collectionLogItemIds: [11286],
        collectionLogItems: [{ id: 11286, name: "Draconic visage" }],
        skills: [{ name: "Cooking", previousLevel: 97, currentLevel: 98, xpGained: 450_000 }],
        bank: {
          previousItemCount: 0,
          currentItemCount: 612,
          previousUnavailableReason: "bank-not-opened-this-session",
          currentUnavailableReason: null,
          enabledChanged: false,
          itemCountChanged: true,
          statusChanged: true
        },
        accountType: { previous: "normal", current: "normal", changed: false }
      }
    });

    expect(summary.xpGainedLabel).toBe("+450k XP since last scan");
    expect(summary.memoryLines).toEqual([
      "+450k XP since last scan",
      "1 quest finished",
      "1 diary tier finished",
      "1 clog slot added"
    ]);
  });
});
