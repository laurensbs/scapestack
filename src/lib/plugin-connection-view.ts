import { syncMemoryLines } from "./next-plugin-sync-summary";
import { isPluginBankStatusStale } from "./plugin-bank-status";
import { CURRENT_PLUGIN_VERSION, pluginSyncHealth, type PluginSyncHealth } from "./plugin-sync";
import type { SyncedPlayer } from "./sync-repo";

export interface PluginConnectionView {
  health: PluginSyncHealth;
  title: string;
  instruction: string;
  scanLabel: string;
  changedLine: string;
  bankLine: string;
}

export function formatPluginScanLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Last scan unknown";
  const value = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
  return `Last scan ${value}`;
}

export function pluginChangedLine(player: SyncedPlayer): string {
  const lines = syncMemoryLines(player.lastSyncSummary).filter((line) => !line.startsWith("Bank snapshot:"));
  if (lines.length === 0) return "First scan saved. The next scan will show what changed.";
  return `Since the previous scan: ${lines.slice(0, 2).join(" and ")}.`;
}

export function pluginBankConnectionLine(player: SyncedPlayer, nowMs = Date.now()): string {
  const status = player.bankStatus;
  if (isPluginBankStatusStale(status, nowMs)) {
    return "Bank needs a refresh. Open it in RuneLite before pressing Sync now.";
  }
  if (status.enabled && status.itemCount > 0) {
    return `Bank included: ${status.itemCount.toLocaleString()} stack${status.itemCount === 1 ? "" : "s"}.`;
  }
  if (status.enabled) {
    return "Bank not included yet. Open it in RuneLite before pressing Sync now.";
  }
  return "Bank sync is off. Scapestack will use your saved browser bank or stay conservative.";
}

export function pluginConnectionView(player: SyncedPlayer, nowMs = Date.now()): PluginConnectionView {
  const health = pluginSyncHealth({
    pluginVersion: player.pluginVersion,
    syncedAt: player.syncedAt
  });

  if (health === "outdated") {
    return {
      health,
      title: "Update Scapestack Sync",
      instruction: `Update to v${CURRENT_PLUGIN_VERSION} in RuneLite, restart RuneLite, then press Sync now.`,
      scanLabel: formatPluginScanLabel(player.syncedAt),
      changedLine: pluginChangedLine(player),
      bankLine: pluginBankConnectionLine(player, nowMs)
    };
  }

  if (health === "stale") {
    return {
      health,
      title: "Refresh RuneLite",
      instruction: "Open RuneLite, press Sync now, then check again here.",
      scanLabel: formatPluginScanLabel(player.syncedAt),
      changedLine: pluginChangedLine(player),
      bankLine: pluginBankConnectionLine(player, nowMs)
    };
  }

  return {
    health,
    title: "RuneLite is connected",
    instruction: "Finished quests, diary tiers, clog slots and Slayer progress now stay out of the wrong trips.",
    scanLabel: formatPluginScanLabel(player.syncedAt),
    changedLine: pluginChangedLine(player),
    bankLine: pluginBankConnectionLine(player, nowMs)
  };
}
