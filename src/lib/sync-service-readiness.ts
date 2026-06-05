import { hasDatabase, sql } from "./db";
import { CURRENT_PLUGIN_VERSION } from "./plugin-sync";

export const SYNC_SERVICE_LIMITS = {
  maxBodyBytes: 1_000_000,
  quests: 500,
  diaries: 64,
  collectionLogItems: 2000
};

export const REQUIRED_PLAYER_SYNC_COLUMNS = [
  "rsn",
  "display_name",
  "quests_completed",
  "diaries_completed",
  "collection_log_item_ids",
  "slayer",
  "plugin_version",
  "synced_at"
];

export const REQUIRED_PLAYER_CLAIM_COLUMNS = [
  "rsn",
  "token_hash",
  "claimed_at",
  "last_used_at"
];

export interface SyncServiceStatus {
  ok: true;
  service: "scapestack-sync";
  ready: boolean;
  plugin: {
    currentVersion: string;
  };
  endpoints: {
    sync: "/api/sync";
    claim: "/api/sync/claim";
  };
  limits: typeof SYNC_SERVICE_LIMITS;
  database: {
    configured: boolean;
    ready: boolean;
    missingTables: string[];
    missingColumns: Record<string, string[]>;
    reason?: string;
  };
}

export async function getSyncServiceStatus(): Promise<SyncServiceStatus> {
  const database = await syncDatabaseReadiness();
  return {
    ok: true,
    service: "scapestack-sync",
    ready: database.ready,
    plugin: {
      currentVersion: CURRENT_PLUGIN_VERSION
    },
    endpoints: {
      sync: "/api/sync",
      claim: "/api/sync/claim"
    },
    limits: SYNC_SERVICE_LIMITS,
    database
  };
}

async function syncDatabaseReadiness(): Promise<SyncServiceStatus["database"]> {
  if (!hasDatabase()) {
    return {
      configured: false,
      ready: false,
      missingTables: ["player_sync", "player_claim"],
      missingColumns: {},
      reason: "DATABASE_URL is not set"
    };
  }

  try {
    const rows = await sql()`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('player_sync', 'player_claim')
    ` as Array<{ table_name: string; column_name: string }>;

    const columnsByTable = new Map<string, Set<string>>();
    for (const row of rows) {
      if (!columnsByTable.has(row.table_name)) columnsByTable.set(row.table_name, new Set());
      columnsByTable.get(row.table_name)!.add(row.column_name);
    }

    const missingTables = ["player_sync", "player_claim"].filter((table) => !columnsByTable.has(table));
    const missingColumns = {
      player_sync: missingColumnsFor(columnsByTable.get("player_sync"), REQUIRED_PLAYER_SYNC_COLUMNS),
      player_claim: missingColumnsFor(columnsByTable.get("player_claim"), REQUIRED_PLAYER_CLAIM_COLUMNS)
    };
    const hasMissingColumns = Object.values(missingColumns).some((columns) => columns.length > 0);

    return {
      configured: true,
      ready: missingTables.length === 0 && !hasMissingColumns,
      missingTables,
      missingColumns
    };
  } catch (error) {
    return {
      configured: true,
      ready: false,
      missingTables: [],
      missingColumns: {},
      reason: error instanceof Error ? error.message : "Unable to inspect sync schema"
    };
  }
}

function missingColumnsFor(actual: Set<string> | undefined, required: string[]): string[] {
  if (!actual) return required;
  return required.filter((column) => !actual.has(column));
}
