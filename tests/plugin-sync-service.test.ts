import { describe, expect, it } from "vitest";
import { summarizePluginSyncService } from "@/lib/plugin-sync-service";
import { DB_INIT_COMMAND } from "@/lib/plugin-sync-actions";

describe("plugin sync service summary", () => {
  it("summarizes the loading state", () => {
    expect(summarizePluginSyncService(null)).toMatchObject({
      tone: "neutral",
      label: "Checking RuneLite",
      actions: []
    });
  });

  it("flags missing database configuration", () => {
    expect(summarizePluginSyncService({
      ready: false,
      database: {
        configured: false,
        ready: false,
        missingTables: ["player_sync", "player_claim"],
        missingColumns: {},
        reason: "DATABASE_URL is not set"
      }
    })).toMatchObject({
      tone: "danger",
      label: "RuneLite needs setup",
      actions: [
        { label: "Copy setup command", copy: DB_INIT_COMMAND }
      ]
    });
  });

  it("does not expose endpoint copy for local browser origins", () => {
    expect(summarizePluginSyncService({
      ready: false,
      database: {
        configured: false,
        ready: false,
        missingTables: ["player_sync"],
        missingColumns: {}
      }
    }, "http://127.0.0.1:4173/plugin")).toMatchObject({
      actions: [
        { label: "Copy setup command", copy: DB_INIT_COMMAND }
      ]
    });
  });

  it("keeps setup blockers player-facing", () => {
    const summary = summarizePluginSyncService({
      ready: false,
      database: {
        configured: true,
        ready: false,
        missingTables: [],
        missingColumns: {
          player_sync: ["slayer"],
          player_claim: []
        }
      }
    });

    expect(summary.tone).toBe("danger");
    expect(summary.label).toBe("RuneLite needs setup");
    expect(summary.detail).toBe("This install needs setup before RuneLite can help plans.");
    expect(summary.detail).not.toContain("player_sync.slayer");
    expect(summary.actions).toEqual([{ label: "Copy setup command", copy: DB_INIT_COMMAND }]);
  });

  it("summarizes a ready sync service", () => {
    expect(summarizePluginSyncService({
      ready: true,
      plugin: { currentVersion: "0.2.0" },
      endpoints: { sync: "/api/sync", claim: "/api/sync/claim" },
      database: {
        configured: true,
        ready: true,
        missingTables: [],
        missingColumns: { player_sync: [], player_claim: [] }
      }
    })).toMatchObject({
      tone: "good",
      label: "RuneLite ready",
      detail: "Scapestack Sync v0.2.0 is ready.",
      actions: []
    });
  });

  it("keeps ready local services free of copy endpoint actions", () => {
    expect(summarizePluginSyncService({
      ready: true,
      plugin: { currentVersion: "0.2.0" },
      endpoints: { sync: "/api/sync", claim: "/api/sync/claim" },
      database: {
        configured: true,
        ready: true,
        missingTables: [],
        missingColumns: { player_sync: [], player_claim: [] }
      }
    }, "http://127.0.0.1:4173")).toMatchObject({
      actions: []
    });
  });
});
