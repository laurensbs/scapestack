import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncedPlayer } from "@/lib/sync-repo";
import { pluginSyncReceipt, type PluginSyncReceipt } from "@/lib/plugin-sync-receipt";
import type { PluginSnapshotCoverage } from "@/lib/plugin-snapshot-contract";
import {
  formatPluginScanLabel,
  pluginBankConnectionLine,
  pluginChangedLine,
  pluginConnectionView
} from "@/lib/plugin-connection-view";

const fullCoverage: PluginSnapshotCoverage = Object.fromEntries([
  "skills", "quests", "diaries", "collectionLog", "bossKc", "slayer", "accountMode", "bank"
].map((domain) => [domain, {
  state: "available",
  capturedAt: "2026-07-17T11:00:00.000Z",
  reason: null
}])) as PluginSnapshotCoverage;

function player(overrides: Partial<SyncedPlayer> = {}): PluginSyncReceipt {
  return pluginSyncReceipt({
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
    snapshotCoverage: fullCoverage,
    lastSyncSummary: null,
    syncedAt: "2026-07-17T11:00:00.000Z",
    ...overrides
  });
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
    expect(view.instruction).toContain("accepted scan");
    expect(view.changedLine).toContain("Scan accepted: skills, quests, diaries, clog, boss KC, Slayer");
    expect(formatPluginScanLabel("2026-07-17T11:00:00.000Z")).toContain("Last scan");
  });

  it("reports unloaded coverage without exposing payload values", () => {
    const changed = pluginChangedLine(player({
      snapshotCoverage: {
        ...fullCoverage,
        collectionLog: { state: "not-loaded", capturedAt: null, reason: "collection-log-not-opened" }
      }
    }));
    expect(changed).toContain("open Collection Log once");
    expect(changed).not.toContain("Animal Magnetism");
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
