import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isRedactedSyncedPlayer,
  redactSyncedPlayer,
  syncedPlayerForViewer
} from "@/lib/synced-player-visibility";
import type { SyncedPlayer } from "@/lib/sync-repo";

function player(overrides: Partial<SyncedPlayer> = {}): SyncedPlayer {
  return {
    rsn: "lynx titan",
    displayName: "Lynx Titan",
    accountType: "normal",
    skills: [{ name: "Attack", level: 99, xp: 200_000_000 }],
    questsCompleted: ["Dragon Slayer II"],
    diariesCompleted: [{ region: "Varrock", tier: "Elite" }],
    collectionLogItemIds: [11832, 20997],
    bossKc: { Vorkath: 900 },
    bankItems: [
      { id: 4151, name: "Abyssal whip", quantity: 1 },
      { id: 995, name: "Coins", quantity: 2_147_000_000 }
    ],
    bankStatus: { enabled: true, itemCount: 2, unavailableReason: null, capturedAt: null },
    slayer: {
      points: 5000, streak: 120, taskRemaining: 42, currentTaskId: 7,
      taskName: "Abyssal demons", taskLocation: "Catacombs", blocks: []
    },
    pluginVersion: "0.3.0",
    lastSyncSummary: null,
    syncedAt: "2026-07-25T12:00:00.000Z",
    ...overrides
  } as SyncedPlayer;
}

describe("synced player visibility", () => {
  it("gives the account owner the untouched snapshot", () => {
    const full = player();
    expect(syncedPlayerForViewer(full, "lynx titan")).toBe(full);
    expect(isRedactedSyncedPlayer(syncedPlayerForViewer(full, "lynx titan"))).toBe(false);
  });

  it("withholds bank, collection log and Slayer task from everyone else", () => {
    for (const viewer of [null, "zezima", "LYNX TITAN".toLowerCase() + " "]) {
      const seen = syncedPlayerForViewer(player(), viewer);
      expect(isRedactedSyncedPlayer(seen), `viewer=${viewer}`).toBe(true);
      expect(seen!.bankItems).toEqual([]);
      expect(seen!.collectionLogItemIds).toEqual([]);
      expect(seen!.slayer).toBeNull();
    }
  });

  it("never leaks an item name or quantity through a redacted snapshot", () => {
    const serialised = JSON.stringify(redactSyncedPlayer(player()));
    expect(serialised).not.toContain("Abyssal whip");
    expect(serialised).not.toContain("Coins");
    expect(serialised).not.toContain("2147000000");
    expect(serialised).not.toContain("Abyssal demons");
    expect(serialised).not.toContain("Catacombs");
  });

  it("drops exact XP but keeps the levels the Hiscores already publish", () => {
    const seen = redactSyncedPlayer(player());
    expect(seen.skills).toEqual([{ name: "Attack", level: 99 }]);
    expect(JSON.stringify(seen)).not.toContain("200000000");
  });

  it("keeps counts so the UI can explain the plan instead of implying emptiness", () => {
    const seen = redactSyncedPlayer(player());
    expect(seen.redactedCounts).toEqual({
      bankItems: 2,
      collectionLogItemIds: 2,
      hasSlayerTask: true
    });
    // Status, freshness and account type are not secrets — they drive copy.
    expect(seen.bankStatus.enabled).toBe(true);
    expect(seen.syncedAt).toBe("2026-07-25T12:00:00.000Z");
    expect(seen.displayName).toBe("Lynx Titan");
  });

  it("passes null through untouched", () => {
    expect(syncedPlayerForViewer(null, "lynx titan")).toBeNull();
  });
});

describe("visibility is enforced at every server boundary", () => {
  const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  it("redacts in loadPlanningContext rather than at a call site", () => {
    const planning = source("src/lib/planning-context.ts");
    expect(planning).toContain("syncedPlayerForViewer(scapestack.value");
    // The raw type must not be what the payload advertises.
    expect(planning).toContain("scapestackSync: VisibleSyncedPlayer | null;");
  });

  it("redacts the publicly callable server actions", () => {
    const actions = source("src/app/actions.ts");
    expect(actions).toContain("syncedPlayerForViewer(await getSyncedPlayer(rsn)");
    expect(actions).toContain("loadPlanningContext(rsn, { viewerRsn: await resolveViewerRsn() })");
    // A bare getSyncedPlayer return would hand the caller everything again.
    expect(actions).not.toMatch(/return getSyncedPlayer\(rsn\);/);
  });

  it("resolves the viewer from the session cookie, never from a query param", () => {
    const viewer = source("src/lib/viewer-account.ts");
    expect(viewer).toContain("ACCOUNT_SESSION_COOKIE");
    expect(viewer).toContain("getConnectedAccount");
    expect(viewer).not.toContain("searchParams");
  });
});
