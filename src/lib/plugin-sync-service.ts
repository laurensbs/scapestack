import { DB_INIT_COMMAND } from "./plugin-sync-actions";

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
  void origin;

  if (!status) {
    return {
      tone: "neutral",
      label: "Checking RuneLite",
      detail: "Scapestack is checking whether RuneLite can help this plan.",
      actions: []
    };
  }

  if (!status.database?.configured) {
    return {
      tone: "danger",
      label: "RuneLite needs setup",
      detail: "This install needs setup before RuneLite can help plans.",
      actions: [
        { label: "Copy setup command", copy: DB_INIT_COMMAND }
      ]
    };
  }

  if (!status.database.ready) {
    return {
      tone: "danger",
      label: "RuneLite needs setup",
      detail: "This install needs setup before RuneLite can help plans.",
      actions: [
        { label: "Copy setup command", copy: DB_INIT_COMMAND }
      ]
    };
  }

  return {
    tone: "good",
    label: "RuneLite ready",
    detail: `Scapestack Sync v${status.plugin?.currentVersion || "unknown"} is ready.`,
    actions: []
  };
}
