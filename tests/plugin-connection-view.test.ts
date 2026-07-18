import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncedPlayer } from "@/lib/sync-repo";
import {
  formatPluginScanLabel,
  pluginBankConnectionLine,
  pluginChangedLine,
  pluginConnectionView
} from "@/lib/plugin-connection-view";

function player(overrides: Partial<SyncedPlayer> = {}): SyncedPlayer {
  return {
    rsn: "lauky",
    displayName: "Lauky",
    accountType: "normal",
    skills: [],
    questsCompleted: [],
    diariesCompleted: [],
    collectionLogItemIds: [],
    bankItems: [{ id: 385, name: "Shark", quantity: 2000 }],
    bankStatus: {
      enabled: true,
      itemCount: 1,
      capturedAt: "2026-07-17T10:55:00.000Z",
      unavailableReason: null
    },
    slayer: null,
    pluginVersion: "0.3.0",
    lastSyncSummary: null,
    syncedAt: "2026-07-17T11:00:00.000Z",
    ...overrides
  };
}

describe("plugin connection view", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("shows a connected player one concise status instead of setup", () => {
    const view = pluginConnectionView(player());
    expect(view).toMatchObject({
      health: "live",
      title: "RuneLite is connected",
      bankLine: "Bank included: 1 stack."
    });
    expect(view.instruction).toContain("Finished quests");
    expect(view.changedLine).toBe("First scan saved. The next scan will show what changed.");
    expect(formatPluginScanLabel("2026-07-17T11:00:00.000Z")).toContain("Last scan");
  });

  it("turns sync changes into one sentence", () => {
    const changed = pluginChangedLine(player({
      lastSyncSummary: {
        previousSyncedAt: "2026-07-17T10:00:00.000Z",
        questsCompleted: ["Animal Magnetism"],
        diariesCompleted: [],
        collectionLogItemIds: [],
        collectionLogItems: [],
        skills: [{ name: "Ranged", previousLevel: 79, currentLevel: 80, xpGained: 125_000 }],
        bank: null,
        accountType: { previous: "normal", current: "normal", changed: false }
      }
    }));
    expect(changed).toBe("Since the previous scan: +125k XP since last scan and 1 quest finished.");
  });

  it("gives stale and outdated scans one exact RuneLite action", () => {
    expect(pluginConnectionView(player({ syncedAt: "2026-07-15T11:00:00.000Z" }))).toMatchObject({
      health: "stale",
      title: "Refresh RuneLite",
      instruction: "Open RuneLite, press Sync now, then check again here."
    });
    expect(pluginConnectionView(player({ pluginVersion: "0.1.9" }))).toMatchObject({
      health: "outdated",
      title: "Update Scapestack Sync"
    });
  });

  it("states bank off, missing capture and stale capture accurately", () => {
    expect(pluginBankConnectionLine(player({
      bankItems: [],
      bankStatus: { enabled: false, itemCount: 0, capturedAt: null, unavailableReason: "opt-in-off" }
    }))).toContain("Bank sync is off");
    expect(pluginBankConnectionLine(player({
      bankItems: [],
      bankStatus: { enabled: true, itemCount: 0, capturedAt: null, unavailableReason: "bank-not-opened-this-session" }
    }))).toContain("Open it in RuneLite");
    expect(pluginBankConnectionLine(player({
      bankStatus: { enabled: true, itemCount: 1, capturedAt: "2026-07-15T10:00:00.000Z", unavailableReason: null }
    }))).toContain("Bank needs a refresh");
  });
});
