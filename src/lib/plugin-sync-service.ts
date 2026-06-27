import { DB_INIT_COMMAND, syncUrlsForOrigin } from "./plugin-sync-actions";

export type PluginSyncServiceTone = "good" | "warning" | "danger" | "neutral";

export interface PluginSyncServiceStatus {
  ready: boolean;
  plugin?: {
    currentVersion?: string;
  };
  database?: {
    configured: boolean;
    ready: boolean;
    missingTables?: string[];
    missingColumns?: Record<string, string[]>;
    reason?: string;
  };
  endpoints?: {
    sync?: string;
    claim?: string;
  };
}

export interface PluginSyncServiceSummary {
  tone: PluginSyncServiceTone;
  label: string;
  detail: string;
  actions: Array<{
    label: string;
    copy: string;
  }>;
}

export function summarizePluginSyncService(status: PluginSyncServiceStatus | null, origin?: string | null): PluginSyncServiceSummary {
  const syncUrls = syncUrlsForOrigin(origin);

  if (!status) {
    return {
      tone: "neutral",
      label: "Checking sync",
      detail: "Scapestack is checking whether RuneLite sync can be stored.",
      actions: []
    };
  }

  if (!status.database?.configured) {
    return {
      tone: "danger",
      label: "Sync storage missing",
      detail: "Scapestack cannot store RuneLite syncs until DATABASE_URL is configured.",
      actions: [
        { label: "Copy schema init", copy: DB_INIT_COMMAND },
        { label: "Copy sync URL", copy: syncUrls.sync }
      ]
    };
  }

  if (!status.database.ready) {
    const missingTables = status.database.missingTables?.length
      ? `missing tables: ${status.database.missingTables.join(", ")}`
      : null;
    const missingColumns = Object.entries(status.database.missingColumns ?? {})
      .filter(([, columns]) => columns.length > 0)
      .map(([table, columns]) => `${table}.${columns.join(`, ${table}.`)}`);
    const details = [missingTables, missingColumns.length ? `missing columns: ${missingColumns.join(", ")}` : null]
      .filter(Boolean)
      .join("; ");

    return {
      tone: "danger",
      label: "Sync storage needs setup",
      detail: details || status.database.reason || "The database is configured, but the sync schema could not be verified.",
      actions: [
        { label: "Copy schema init", copy: DB_INIT_COMMAND },
        { label: "Copy sync URL", copy: syncUrls.sync }
      ]
    };
  }

  return {
    tone: "good",
    label: "Sync ready",
    detail: `Plugin v${status.plugin?.currentVersion || "unknown"} is ready.`,
    actions: [
      { label: "Copy sync URL", copy: syncUrls.sync }
    ]
  };
}
