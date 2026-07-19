import { describe, expect, it } from "vitest";
import { pluginSyncReceipt } from "@/lib/plugin-sync-receipt";
import type { PluginSnapshotCoverage } from "@/lib/plugin-snapshot-contract";
import type { SyncedPlayer } from "@/lib/sync-repo";

const coverage = Object.fromEntries([
  "skills", "quests", "diaries", "collectionLog", "bossKc", "slayer", "accountMode", "bank"
].map((domain) => [domain, {
  state: "available",
  capturedAt: "2026-07-19T18:00:54.179Z",
  reason: null
}])) as PluginSnapshotCoverage;

describe("privacy-minimized plugin receipt", () => {
  it("proves claim, contract, version, timestamp and coverage without payload values", () => {
    const player: SyncedPlayer = {
      rsn: "lauky",
      displayName: "Lauky",
      accountType: "ironman",
      skills: [{ name: "Cooking", level: 96, xp: 9_999_999 }],
      questsCompleted: ["Secret quest value"],
      diariesCompleted: [{ region: "Secret region", tier: "Elite" }],
      collectionLogItemIds: [12_345],
      bossKc: { "Secret boss": 321 },
      bankItems: [{ id: 3144, name: "Secret bank item", quantity: 500 }],
      bankStatus: { enabled: true, itemCount: 1, capturedAt: "2026-07-19T17:00:00.000Z", unavailableReason: null },
      slayer: { points: 100, streak: 20, taskRemaining: 42, currentTaskId: 1, blocks: [] },
      pluginVersion: "0.3.0",
      snapshotCoverage: coverage,
      lastSyncSummary: null,
      syncedAt: "2026-07-19T18:00:55.460Z"
    };

    const receipt = pluginSyncReceipt(player);
    const serialized = JSON.stringify(receipt);
    expect(receipt).toMatchObject({
      claim: { status: "verified", rsn: "lauky" },
      contractVersion: 3,
      pluginVersion: "0.3.0",
      syncedAt: "2026-07-19T18:00:55.460Z",
      counts: { skills: 1, quests: 1, diaries: 1, collectionLogItems: 1, bossKc: 1, bankItems: 1, slayer: 1 }
    });
    expect(receipt.coverage?.skills.state).toBe("available");
    expect(serialized).not.toContain("Secret quest value");
    expect(serialized).not.toContain("Secret bank item");
    expect(serialized).not.toContain("Secret boss");
    expect(serialized).not.toContain("9999999");
  });
});
