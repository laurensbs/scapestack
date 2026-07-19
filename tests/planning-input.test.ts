import { describe, expect, it } from "vitest";
import { buildNextUpInputFromSources } from "@/lib/planning-input";
import type { SyncedPlayer } from "@/lib/sync-repo";

function syncedPlayer(): SyncedPlayer {
  return {
    rsn: "lauky",
    displayName: "Lauky",
    accountType: "ironman",
    skills: [{ name: "Cooking", level: 96, xp: 10_000_000 }],
    questsCompleted: ["Cook's Assistant"],
    diariesCompleted: [],
    collectionLogItemIds: [],
    bossKc: { Vorkath: 48 },
    bankItems: [{ id: 371, name: "Raw swordfish", quantity: 250 }],
    bankStatus: {
      enabled: true,
      itemCount: 1,
      capturedAt: new Date().toISOString(),
      unavailableReason: null
    },
    slayer: null,
    pluginVersion: "0.3.0",
    lastSyncSummary: null,
    syncedAt: new Date().toISOString()
  };
}

describe("shared first-plan input", () => {
  it("uses a fresh RuneLite bank for the RSN-only path", () => {
    const input = buildNextUpInputFromSources({
      rsn: "Lauky",
      hiscores: null,
      wom: null,
      scapestackSync: syncedPlayer()
    });

    expect(input?.bank).toEqual([{ id: 371, name: "Raw swordfish", quantity: 250 }]);
    expect(input?.accountMeta?.accountType).toBe("ironman");
    expect(input?.bossKc?.Vorkath).toBe(48);
  });

  it("lets an explicit browser bank override the RuneLite bank", () => {
    const input = buildNextUpInputFromSources({
      rsn: "Lauky",
      hiscores: null,
      wom: null,
      scapestackSync: syncedPlayer(),
      bankOverride: [{ id: 3144, name: "Cooked karambwan", quantity: 100 }]
    });

    expect(input?.bank).toEqual([{ id: 3144, name: "Cooked karambwan", quantity: 100 }]);
  });

  it("returns no planner input when every truthful account source misses", () => {
    expect(buildNextUpInputFromSources({
      rsn: "Missing",
      hiscores: null,
      wom: null,
      scapestackSync: null
    })).toBeNull();
  });

  it("keeps not-loaded domains unknown instead of turning them into empty facts", () => {
    const player = syncedPlayer();
    player.collectionLogItemIds = [];
    player.bossKc = { Vorkath: 48 };
    player.slayer = {
      points: 100,
      streak: 20,
      taskRemaining: 42,
      currentTaskId: 1,
      blocks: []
    };
    player.availability = {
      skills: "available",
      quests: "available",
      diaries: "available",
      collectionLog: "not-loaded",
      bossKc: "not-loaded",
      slayer: "not-loaded",
      bank: "not-loaded"
    };

    const input = buildNextUpInputFromSources({
      rsn: "Lauky",
      hiscores: null,
      wom: null,
      scapestackSync: player
    });

    expect(input?.scapestackSync?.collectionLogItemIds).toBeUndefined();
    expect(input?.scapestackSync?.bossKc).toBeUndefined();
    expect(input?.scapestackSync?.slayer).toBeUndefined();
    expect(input?.bossKc?.Vorkath).toBeUndefined();
    // A recent last-known bank remains usable, but its availability is still
    // carried so UI/evidence can ask the player to open the bank to refresh.
    expect(input?.bank).toHaveLength(1);
    expect(input?.syncedSources?.scapestack?.availability?.bank).toBe("not-loaded");
  });

  it("never reuses bank values after bank permission is turned off", () => {
    const player = syncedPlayer();
    player.bankStatus = { enabled: false, itemCount: 0, capturedAt: null, unavailableReason: "opt-in-off" };
    player.availability = { bank: "permission-off" };

    const input = buildNextUpInputFromSources({
      rsn: "Lauky",
      hiscores: null,
      wom: null,
      scapestackSync: player
    });
    expect(input?.bank).toEqual([]);
  });
});
