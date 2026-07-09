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
import { DB_INIT_COMMAND } from "@/lib/plugin-sync-actions";

function player(overrides: Partial<SyncedPlayer> = {}): SyncedPlayer {
  const base: SyncedPlayer = {
    rsn: "lynx titan",
    displayName: "Lynx Titan",
    accountType: "normal",
    skills: [{ name: "Agility", level: 35 }],
    questsCompleted: ["Cook's Assistant"],
    diariesCompleted: [{ region: "Lumbridge & Draynor", tier: "Easy" }],
    collectionLogItemIds: [4151],
    bankItems: [{ id: 1511, name: "Logs", quantity: 6 }],
    bankStatus: { enabled: true, itemCount: 1, capturedAt: "2026-06-03T11:30:00.000Z", unavailableReason: null },
    slayer: {
      points: 100,
      streak: 50,
      taskRemaining: 42,
      currentTaskId: 1337,
      blocks: ["dust_devil"]
    },
    pluginVersion: CURRENT_PLUGIN_VERSION,
    lastSyncSummary: null,
    syncedAt: "2026-06-03T11:30:00.000Z"
  };
  return {
    ...base,
    ...overrides,
    skills: overrides.skills ?? base.skills,
    bankItems: overrides.bankItems ?? base.bankItems,
    bankStatus: overrides.bankStatus ?? (
      overrides.bankItems
        ? {
            enabled: overrides.bankItems.length > 0,
            itemCount: overrides.bankItems.length,
            capturedAt: overrides.bankItems.length > 0 ? base.syncedAt : null,
            unavailableReason: overrides.bankItems.length > 0 ? null : "opt-in-off"
          }
        : base.bankStatus
    )
  };
}

describe("plugin sync diagnostics", () => {
  it("labels plugin health states for checker badges", () => {
    expect(healthLabel("live")).toBe("RuneLite is helping");
    expect(healthLabel("stale")).toBe("Refresh RuneLite");
    expect(healthLabel("outdated")).toBe("Update RuneLite");
  });

  it("marks current full sync as ready for /next", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00.000Z"));

    const diagnostic = diagnosticForSyncedPlayer(player());
    expect(diagnostic.tone).toBe("good");
    expect(diagnostic.title).toContain("RuneLite is helping");
    expect(diagnostic.title).not.toContain("Exact account state");
    expect(diagnostic.primaryAction?.label).toBe("Open next plan");
    expect(diagnostic.secondaryAction?.label).toBe("Open Slayer task");
    expect(diagnostic.primaryAction?.href).toBe("/next?rsn=Lynx+Titan&source=plugin-sync&bank=none");
    expect(diagnostic.secondaryAction?.href).toBe("/slayer?rsn=Lynx+Titan&source=plugin-sync&bank=none");

    const readiness = nextReadinessForSyncedPlayer(player());
    expect(readiness.tone).toBe("good");
    expect(readiness.title).toBe("RuneLite is helping /next");
    expect(readiness.actionLabel).toBe("Open next plan");
    expect(readiness.body).toContain("skip finished quests");

    const coverage = signalCoverageForSyncedPlayer(player());
    expect(coverage.map((signal) => [signal.label, signal.status])).toEqual([
      ["Skills", "exact"],
      ["Quests", "exact"],
      ["Diaries", "exact"],
      ["Collection log", "exact"],
      ["Bank", "exact"],
      ["Slayer", "exact"]
    ]);

    vi.useRealTimers();
  });

  it("turns a live full sync into an OSRS session action queue", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00.000Z"));

    const queue = actionQueueForSyncedPlayer(player());

    expect(queue.map((action) => action.title)).toEqual([
      "Open next plan",
      "Route the live Slayer task",
      "Use RuneLite bank for item checks"
    ]);
    expect(queue[0]).toMatchObject({
      tone: "good",
      href: "/next?rsn=Lynx+Titan&source=plugin-sync&bank=none",
      actionLabel: "Open next plan"
    });
    expect(queue[1]).toMatchObject({
      tone: "good",
      href: "/slayer?rsn=Lynx+Titan&source=plugin-sync&bank=none"
    });
    expect(queue[2]).toMatchObject({
      tone: "good",
      href: "/next?rsn=Lynx+Titan&source=plugin-sync&bank=none"
    });
    expect(queue[2].proof).toContain("Quest and diary readiness");

    vi.useRealTimers();
  });

  it("does not treat a stale bank capture as exact item readiness", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-04T13:00:00.000Z"));

    const staleBankPlayer = player({
      syncedAt: "2026-06-04T12:30:00.000Z",
      bankStatus: {
        enabled: true,
        itemCount: 1,
        capturedAt: "2026-06-03T11:30:00.000Z",
        unavailableReason: null
      }
    });

    const coverage = signalCoverageForSyncedPlayer(staleBankPlayer);
    expect(coverage.find((signal) => signal.label === "Bank")).toMatchObject({
      status: "partial",
      summary: "Bank sync is stale; open your bank in RuneLite, then sync again"
    });
    expect(actionQueueForSyncedPlayer(staleBankPlayer).map((action) => action.title)).toContain("Refresh RuneLite bank");

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
      "Open /next without Slayer",
      "Use RuneLite bank for item checks"
    ]);
    expect(queue[0].copy).toBeUndefined();
    expect(queue[0].actionLabel).toBeUndefined();
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

  it("warns when a sync is stale", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T12:00:00.000Z"));

    const diagnostic = diagnosticForSyncedPlayer(player());
    expect(diagnostic.tone).toBe("warning");
    expect(diagnostic.title).toContain("fresh press");
    expect(diagnostic.primaryAction).toBeUndefined();
    expect(diagnosticForSyncedPlayer(player(), { origin: "http://127.0.0.1:4173/plugin" }).primaryAction)
      .toBeUndefined();

    const readiness = nextReadinessForSyncedPlayer(player());
    expect(readiness.tone).toBe("warning");
    expect(readiness.title).toContain("Press Sync");
    expect(readiness.actionLabel).toBe("Open stale /next plan");

    expect(signalCoverageForSyncedPlayer(player()).every((signal) => signal.status === "refresh")).toBe(true);
    expect(actionQueueForSyncedPlayer(player()).map((action) => action.title)).toEqual([
      "Press Sync in RuneLite first",
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

  it("warns when live sync lacks Slayer state", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00.000Z"));

    const diagnostic = diagnosticForSyncedPlayer(player({ slayer: null }));
    expect(diagnostic.tone).toBe("warning");
    expect(diagnostic.title).toContain("Slayer state is missing");
    expect(diagnostic.primaryAction?.href).toBe("/next?rsn=Lynx+Titan&source=plugin-sync&bank=none");

    const readiness = nextReadinessForSyncedPlayer(player({ slayer: null }));
    expect(readiness.tone).toBe("warning");
    expect(readiness.title).toContain("Slayer will be guessed");
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
    expect(missing.primaryAction).toBeUndefined();
    expect(diagnosticForMissingSync("Lynx Titan", { origin: "http://127.0.0.1:4173" }).primaryAction)
      .toBeUndefined();
    expect(missing.title).toBe("RuneLite not found for Lynx Titan");
    expect(missing.body).toContain("/next still works from your OSRS name");
    expect(missing.steps.join(" ")).toContain("Open RuneLite");
    expect(missing.steps.join(" ")).toContain("Press Sync now");
    expect(missing.steps.join(" ")).toContain("Sync on login");
    expect(missing.steps.join(" ")).not.toContain("Install Scapestack Sync, then enable");
    expect(missing.steps.length).toBe(3);

    const unconfigured = diagnosticForUnconfiguredSync();
    expect(unconfigured.tone).toBe("danger");
    expect(unconfigured.title).toBe("RuneLite needs setup");
    expect(unconfigured.primaryAction?.copy).toBe(DB_INIT_COMMAND);
    expect(unconfigured.steps.join(" ")).toContain("setup command");
    expect(unconfigured.steps.join(" ")).not.toContain("DATABASE_URL");
    expect(unconfigured.steps.join(" ")).toContain("Sync on login");
  });
});
