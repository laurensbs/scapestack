import { describe, expect, it } from "vitest";
import { summarizePluginSyncService } from "@/lib/plugin-sync-service";
import { DB_INIT_COMMAND, LOCAL_SYNC_CLAIM_URL, LOCAL_SYNC_URL, PUBLIC_SYNC_CLAIM_URL, PUBLIC_SYNC_URL } from "@/lib/plugin-sync-actions";

describe("plugin sync service summary", () => {
  it("summarizes the loading state", () => {
    expect(summarizePluginSyncService(null)).toMatchObject({
      tone: "neutral",
      label: "Checking sync service",
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
      label: "Sync database missing",
      actions: [
        { label: "Copy schema init", copy: DB_INIT_COMMAND },
        { label: "Copy sync URL", copy: PUBLIC_SYNC_URL }
      ]
    });
  });

  it("copies local sync URLs when checking a local browser origin", () => {
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
        { label: "Copy schema init", copy: DB_INIT_COMMAND },
        { label: "Copy sync URL", copy: LOCAL_SYNC_URL }
      ]
    });
  });

  it("reports missing schema details", () => {
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
    expect(summary.label).toBe("Sync schema incomplete");
    expect(summary.detail).toContain("player_sync.slayer");
    expect(summary.actions).toContainEqual({ label: "Copy schema init", copy: DB_INIT_COMMAND });
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
      label: "Sync service ready",
      detail: "Plugin v0.2.0 · /api/sync and /api/sync/claim are available.",
      actions: [
        { label: "Copy sync URL", copy: PUBLIC_SYNC_URL },
        { label: "Copy claim URL", copy: PUBLIC_SYNC_CLAIM_URL }
      ]
    });
  });

  it("copies local claim URLs for ready local services", () => {
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
      actions: [
        { label: "Copy sync URL", copy: LOCAL_SYNC_URL },
        { label: "Copy claim URL", copy: LOCAL_SYNC_CLAIM_URL }
      ]
    });
  });
});
