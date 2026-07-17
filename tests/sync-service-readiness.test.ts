import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  dbConfigured: false,
  dbRows: [] as Array<{ table_name: string; column_name: string }>,
  dbError: null as Error | null
}));

vi.mock("@/lib/db", () => ({
  hasDatabase: () => state.dbConfigured,
  sql: () => async () => {
    if (state.dbError) throw state.dbError;
    return state.dbRows;
  }
}));

import {
  getSyncServiceStatus,
  REQUIRED_PLAYER_CLAIM_COLUMNS,
  REQUIRED_PLAYER_SYNC_COLUMNS,
  SYNC_SERVICE_LIMITS
} from "@/lib/sync-service-readiness";

beforeEach(() => {
  state.dbConfigured = false;
  state.dbRows = [];
  state.dbError = null;
});

function readySchemaRows(): Array<{ table_name: string; column_name: string }> {
  return [
    ...REQUIRED_PLAYER_SYNC_COLUMNS.map((column_name) => ({ table_name: "player_sync", column_name })),
    ...REQUIRED_PLAYER_CLAIM_COLUMNS.map((column_name) => ({ table_name: "player_claim", column_name }))
  ];
}

describe("sync service readiness", () => {
  it("reports DATABASE_URL as the blocker when storage is not configured", async () => {
    await expect(getSyncServiceStatus()).resolves.toMatchObject({
      ok: true,
      service: "scapestack-sync",
      ready: false,
      plugin: { currentVersion: "0.3.0" },
      endpoints: { sync: "/api/sync", claim: "/api/sync/claim" },
      database: {
        configured: false,
        ready: false,
        missingTables: ["player_sync", "player_claim"],
        missingColumns: {},
        reason: "DATABASE_URL is not set"
      }
    });
  });

  it("reports ready when both sync tables expose required columns", async () => {
    state.dbConfigured = true;
    state.dbRows = readySchemaRows();

    await expect(getSyncServiceStatus()).resolves.toMatchObject({
      ready: true,
      limits: SYNC_SERVICE_LIMITS,
      database: {
        configured: true,
        ready: true,
        missingTables: [],
        missingColumns: { player_sync: [], player_claim: [] }
      }
    });
  });

  it("reports exact missing columns per table", async () => {
    state.dbConfigured = true;
    state.dbRows = readySchemaRows().filter((row) =>
      !(row.table_name === "player_sync" && row.column_name === "slayer")
    );

    const status = await getSyncServiceStatus();

    expect(status.ready).toBe(false);
    expect(status.database.missingTables).toEqual([]);
    expect(status.database.missingColumns.player_sync).toContain("slayer");
    expect(status.database.missingColumns.player_claim).toEqual([]);
  });

  it("keeps failures non-fatal and visible to the UI", async () => {
    state.dbConfigured = true;
    state.dbError = new Error("permission denied for information_schema");

    await expect(getSyncServiceStatus()).resolves.toMatchObject({
      ready: false,
      database: {
        configured: true,
        ready: false,
        missingTables: [],
        missingColumns: {},
        reason: "permission denied for information_schema"
      }
    });
  });
});
