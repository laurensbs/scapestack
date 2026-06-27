import { describe, expect, it, vi } from "vitest";
import type { SyncedPlayer } from "@/lib/sync-repo";
import {
  actionQueueForSyncedPlayer,
  diagnosticForMissingSync,
  diagnosticForSyncedPlayer,
  diagnosticForUnconfiguredSync,
  healthLabel,
  nextReadinessForSyncedPlayer,
  signalCoverageForSyncedPlayer
} from "@/lib/plugin-sync-diagnostics";
import { CURRENT_PLUGIN_VERSION } from "@/lib/plugin-sync";
import { DB_INIT_COMMAND, LOCAL_SYNC_URL, PUBLIC_SYNC_URL } from "@/lib/plugin-sync-actions";

function player(overrides: Partial<SyncedPlayer> = {}): SyncedPlayer {
  return {
    rsn: "lynx titan",
    displayName: "Lynx Titan",
    questsCompleted: ["Cook's Assistant"],
    diariesCompleted: [{ region: "Lumbridge & Draynor", tier: "Easy" }],
    collectionLogItemIds: [4151],
    slayer: {
      points: 100,
      streak: 50,
      taskRemaining: 42,
      currentTaskId: 1337,
      blocks: ["dust_devil"]
    },
    pluginVersion: CURRENT_PLUGIN_VERSION,
    syncedAt: "2026-06-03T11:30:00.000Z",
    ...overrides
  };
}

describe("plugin sync diagnostics", () => {
  it("labels plugin health states for checker badges", () => {
    expect(healthLabel("live")).toBe("Live sync found");
    expect(healthLabel("stale")).toBe("Sync is stale");
    expect(healthLabel("outdated")).toBe("Plugin update needed");
  });

  it("marks current full sync as ready for /next", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00.000Z"));

    const diagnostic = diagnosticForSyncedPlayer(player());
    expect(diagnostic.tone).toBe("good");
    expect(diagnostic.title).toContain("RuneLite sync is live");
    expect(diagnostic.title).not.toContain("Exact account state");
    expect(diagnostic.primaryAction?.label).toBe("Open synced /next plan");
    expect(diagnostic.secondaryAction?.label).toBe("Open synced Slayer");
    expect(diagnostic.primaryAction?.href).toBe("/next?rsn=Lynx+Titan&source=plugin-sync&bank=none");
    expect(diagnostic.secondaryAction?.href).toBe("/slayer?rsn=Lynx+Titan&source=plugin-sync&bank=none");

    const readiness = nextReadinessForSyncedPlayer(player());
    expect(readiness.tone).toBe("good");
    expect(readiness.title).toBe("RuneLite sync is ready for /next");
    expect(readiness.actionLabel).toBe("Open synced /next plan");
    expect(readiness.body).toContain("this sync");

    const coverage = signalCoverageForSyncedPlayer(player());
    expect(coverage.map((signal) => [signal.label, signal.status])).toEqual([
      ["Quests", "exact"],
      ["Diaries", "exact"],
      ["Collection log", "exact"],
      ["Slayer", "exact"]
    ]);

    vi.useRealTimers();
  });

  it("turns a live full sync into an OSRS session action queue", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00.000Z"));

    const queue = actionQueueForSyncedPlayer(player());

    expect(queue.map((action) => action.title)).toEqual([
      "Open synced /next plan",
      "Route the live Slayer task",
      "Paste bank for gear and GP context"
    ]);
    expect(queue[0]).toMatchObject({
      tone: "good",
      href: "/next?rsn=Lynx+Titan&source=plugin-sync&bank=none",
      actionLabel: "Open synced /next"
    });
    expect(queue[1]).toMatchObject({
      tone: "good",
      href: "/slayer?rsn=Lynx+Titan&source=plugin-sync&bank=none"
    });
    expect(queue[2]).toMatchObject({
      tone: "neutral",
      href: "/bank?rsn=Lynx%20Titan&from=plugin"
    });
    expect(queue[2].proof).toContain("never goes back to the plugin");

    vi.useRealTimers();
  });

  it("prioritizes collection-log and Slayer refreshes before partial planning", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00.000Z"));

    const queue = actionQueueForSyncedPlayer(player({
      collectionLogItemIds: [],
      slayer: null
    }), { origin: "http://127.0.0.1:4173/plugin" });

    expect(queue.map((action) => action.title)).toEqual([
      "Open Collection Log tabs in-game",
      "Refresh Slayer state",
      "Open /next without Slayer sync",
      "Paste bank for gear and GP context"
    ]);
    expect(queue[0]).toMatchObject({
      copy: LOCAL_SYNC_URL,
      actionLabel: "Copy sync URL"
    });
    expect(queue[1]).toMatchObject({
      tone: "warning",
      actionLabel: "Open /next without Slayer"
    });
    expect(queue[2]).toMatchObject({
      tone: "warning",
      href: "/next?rsn=Lynx+Titan&source=plugin-sync&bank=none"
    });

    vi.useRealTimers();
  });

  it("warns when a payload is stale", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T12:00:00.000Z"));

    const diagnostic = diagnosticForSyncedPlayer(player());
    expect(diagnostic.tone).toBe("warning");
    expect(diagnostic.title).toContain("stale");
    expect(diagnostic.primaryAction?.copy).toBe(PUBLIC_SYNC_URL);
    expect(diagnosticForSyncedPlayer(player(), { origin: "http://127.0.0.1:4173/plugin" }).primaryAction?.copy)
      .toBe(LOCAL_SYNC_URL);

    const readiness = nextReadinessForSyncedPlayer(player());
    expect(readiness.tone).toBe("warning");
    expect(readiness.title).toContain("Refresh sync");
    expect(readiness.actionLabel).toBe("Open stale /next plan");

    expect(signalCoverageForSyncedPlayer(player()).every((signal) => signal.status === "refresh")).toBe(true);
    expect(actionQueueForSyncedPlayer(player()).map((action) => action.title)).toEqual([
      "Refresh RuneLite sync first",
      "Open current /next if you must"
    ]);

    vi.useRealTimers();
  });

  it("flags old plugin versions before freshness or slayer checks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00.000Z"));

    const diagnostic = diagnosticForSyncedPlayer(player({
      pluginVersion: "0.1.0",
      slayer: null
    }));
    expect(diagnostic.tone).toBe("danger");
    expect(diagnostic.title).toContain("Plugin update");
    expect(diagnostic.body).toContain(CURRENT_PLUGIN_VERSION);

    const readiness = nextReadinessForSyncedPlayer(player({
      pluginVersion: "0.1.0",
      slayer: null
    }));
    expect(readiness.tone).toBe("danger");
    expect(readiness.title).toContain("Fix plugin version");
    expect(readiness.actionLabel).toBe("Open /next anyway");
    expect(signalCoverageForSyncedPlayer(player({
      pluginVersion: "0.1.0",
      slayer: null
    })).every((signal) => signal.status === "update")).toBe(true);
    expect(actionQueueForSyncedPlayer(player({
      pluginVersion: "0.1.0",
      slayer: null
    })).map((action) => action.title)).toEqual([
      "Update Scapestack Sync",
      "Re-sync after RuneLite restarts",
      "Open /next only as fallback"
    ]);

    vi.useRealTimers();
  });

  it("warns when live payload lacks Slayer state", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00.000Z"));

    const diagnostic = diagnosticForSyncedPlayer(player({ slayer: null }));
    expect(diagnostic.tone).toBe("warning");
    expect(diagnostic.title).toContain("Slayer state is missing");
    expect(diagnostic.primaryAction?.href).toBe("/next?rsn=Lynx+Titan&source=plugin-sync&bank=none");

    const readiness = nextReadinessForSyncedPlayer(player({ slayer: null }));
    expect(readiness.tone).toBe("warning");
    expect(readiness.title).toContain("Slayer will be inferred");
    expect(readiness.actionLabel).toBe("Open /next without Slayer");

    const coverage = signalCoverageForSyncedPlayer(player({
      collectionLogItemIds: [],
      slayer: null
    }));
    expect(coverage.find((signal) => signal.label === "Collection log")?.status).toBe("partial");
    expect(coverage.find((signal) => signal.label === "Slayer")?.status).toBe("missing");

    vi.useRealTimers();
  });

  it("gives concrete recovery steps for missing and unconfigured sync", () => {
    const missing = diagnosticForMissingSync("Lynx Titan");
    expect(missing.tone).toBe("warning");
    expect(missing.primaryAction?.copy).toBe(PUBLIC_SYNC_URL);
    expect(diagnosticForMissingSync("Lynx Titan", { origin: "http://127.0.0.1:4173" }).primaryAction?.copy)
      .toBe(LOCAL_SYNC_URL);
    expect(missing.steps.join(" ")).toContain("Open RuneLite");
    expect(missing.steps.join(" ")).toContain("https://www.scapestack.org/api/sync");
    expect(missing.steps.join(" ")).toContain("Auto-sync on login");
    expect(missing.steps.join(" ")).not.toContain("Install Scapestack Sync, then enable");

    const unconfigured = diagnosticForUnconfiguredSync();
    expect(unconfigured.tone).toBe("danger");
    expect(unconfigured.primaryAction?.copy).toBe(DB_INIT_COMMAND);
    expect(unconfigured.steps.join(" ")).toContain("DATABASE_URL");
    expect(unconfigured.steps.join(" ")).toContain("Auto-sync on login");
  });
});
