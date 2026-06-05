import { describe, expect, it } from "vitest";
import type { SyncedPlayer } from "@/lib/sync-repo";
import { formatPluginSyncProof, formatPluginSyncSessionChecklist } from "@/lib/plugin-sync-proof";

function player(overrides: Partial<SyncedPlayer> = {}): SyncedPlayer {
  return {
    rsn: "lynx titan",
    displayName: "Lynx Titan",
    questsCompleted: ["Cook's Assistant", "Dragon Slayer II"],
    diariesCompleted: [{ region: "Lumbridge & Draynor", tier: "Easy" }],
    collectionLogItemIds: [4151, 11840, 2577],
    slayer: {
      points: 420,
      streak: 69,
      taskRemaining: 42,
      currentTaskId: 1337,
      blocks: ["dust_devil", "iron_dragon"]
    },
    pluginVersion: "0.2.0",
    syncedAt: "2026-06-03T11:30:00.000Z",
    ...overrides
  };
}

describe("plugin sync proof", () => {
  it("formats a safe support receipt for a full RuneLite payload", () => {
    const proof = formatPluginSyncProof(player());

    expect(proof).toContain("Scapestack Sync proof");
    expect(proof).toContain("RSN: Lynx Titan");
    expect(proof).toContain("Plugin version: v0.2.0");
    expect(proof).toContain("Quests completed: 2");
    expect(proof).toContain("Diary tiers completed: 1");
    expect(proof).toContain("Collection-log item IDs: 3");
    expect(proof).toContain("Task ID: 1337");
    expect(proof).toContain("Remaining: 42");
    expect(proof).toContain("Blocks: 2");
    expect(proof).toContain("Not included:");
  });

  it("does not include secrets or unsupported sensitive data names", () => {
    const proof = formatPluginSyncProof(player());

    expect(proof).not.toContain("token_hash");
    expect(proof).not.toContain("Authorization");
    expect(proof).not.toContain("password");
    expect(proof).not.toContain("inventory:");
    expect(proof).not.toContain("equipment:");
    expect(proof).not.toContain("chat:");
  });

  it("handles payloads without Slayer state explicitly", () => {
    const proof = formatPluginSyncProof(player({ slayer: null }));

    expect(proof).toContain("Slayer: No Slayer payload");
  });

  it("formats a player-facing RuneLite to webapp session checklist", () => {
    const checklist = formatPluginSyncSessionChecklist(player(), { origin: "http://127.0.0.1:4173/plugin" });

    expect(checklist).toContain("Scapestack RuneLite session checklist");
    expect(checklist).toContain("RSN: Lynx Titan");
    expect(checklist).toContain("Open /next with source=plugin-sync and bank=none");
    expect(checklist).toContain("http://127.0.0.1:4173/next?rsn=Lynx+Titan&source=plugin-sync&bank=none");
    expect(checklist).toContain("Route live Slayer: task ID 1337, 42 left, 420 points, 69 streak.");
    expect(checklist).toContain("http://127.0.0.1:4173/slayer?rsn=Lynx+Titan&source=plugin-sync&bank=none");
    expect(checklist).toContain("Collection log suppression is active with 3 synced item IDs.");
    expect(checklist).toContain("Paste Bank Memory or Bank Tags in the browser");
    expect(checklist).toContain("http://127.0.0.1:4173/bank?rsn=Lynx%20Titan&from=plugin");
    expect(checklist).toContain("RuneLite sync does not include bank, inventory, equipment, chat, screenshots, clicks, keys, account login or install token.");
  });

  it("tells partial payload users what to refresh before planning", () => {
    const checklist = formatPluginSyncSessionChecklist(player({
      collectionLogItemIds: [],
      slayer: null
    }));

    expect(checklist).toContain("Refresh Slayer state in RuneLite before trusting task routing.");
    expect(checklist).toContain("Open Collection Log categories in RuneLite, sync again");
  });
});
