import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncedPlayer } from "@/lib/sync-repo";

const state = vi.hoisted(() => ({ player: null as SyncedPlayer | null }));

vi.mock("@/lib/sync-repo", () => ({
  getSyncedPlayer: async () => state.player
}));

function player(): SyncedPlayer {
  return {
    rsn: "lauky",
    displayName: "Lauky",
    accountType: "ironman",
    skills: [{ name: "Cooking", level: 96, xp: 10_000_000 }],
    questsCompleted: ["Private quest"],
    diariesCompleted: [],
    collectionLogItemIds: [],
    bossKc: { Vorkath: 48 },
    bankItems: [{ id: 371, name: "Raw swordfish", quantity: 250 }],
    bankStatus: { enabled: true, itemCount: 1, capturedAt: "2026-07-19T17:00:00.000Z", unavailableReason: null },
    slayer: null,
    pluginVersion: "0.3.0",
    snapshotCoverage: {
      skills: { state: "available", capturedAt: "2026-07-19T18:00:54.000Z", reason: null },
      quests: { state: "available", capturedAt: "2026-07-19T18:00:54.000Z", reason: null },
      diaries: { state: "available", capturedAt: "2026-07-19T18:00:54.000Z", reason: null },
      collectionLog: { state: "not-loaded", capturedAt: null, reason: "collection-log-not-opened" },
      bossKc: { state: "available", capturedAt: "2026-07-19T18:00:54.000Z", reason: null },
      slayer: { state: "available", capturedAt: "2026-07-19T18:00:54.000Z", reason: null },
      accountMode: { state: "available", capturedAt: "2026-07-19T18:00:54.000Z", reason: null },
      bank: { state: "not-loaded", capturedAt: null, reason: "bank-not-opened-this-session" }
    },
    lastSyncSummary: null,
    syncedAt: "2026-07-19T18:00:55.460Z"
  };
}

describe("GET /api/sync/status", () => {
  beforeEach(() => { state.player = null; });

  it("returns a no-store privacy-minimized production receipt", async () => {
    state.player = player();
    const { GET } = await import("@/app/api/sync/status/route");
    const response = await GET(new Request("http://local/api/sync/status?rsn=Lauky"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.player).toMatchObject({
      claim: { status: "verified", rsn: "lauky" },
      contractVersion: 3,
      pluginVersion: "0.3.0",
      syncedAt: "2026-07-19T18:00:55.460Z",
      coverage: { collectionLog: { state: "not-loaded" }, bank: { state: "not-loaded" } }
    });
    expect(JSON.stringify(body)).not.toContain("Private quest");
    expect(JSON.stringify(body)).not.toContain("Raw swordfish");
  });

  it("distinguishes missing from invalid players", async () => {
    const { GET } = await import("@/app/api/sync/status/route");
    expect((await GET(new Request("http://local/api/sync/status?rsn=Lauky"))).status).toBe(404);
    expect((await GET(new Request("http://local/api/sync/status?rsn=%3Cbad%3E"))).status).toBe(400);
  });
});
