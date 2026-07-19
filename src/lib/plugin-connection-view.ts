import { isPluginBankStatusStale } from "./plugin-bank-status";
import { CURRENT_PLUGIN_VERSION, pluginSyncHealth, type PluginSyncHealth } from "./plugin-sync";
import type { PluginSyncReceipt } from "./plugin-sync-receipt";

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

export function pluginChangedLine(player: PluginSyncReceipt): string {
  if (!player.coverage) return "Legacy scan accepted. Sync again for exact coverage.";
  const available = Object.entries(player.coverage)
    .filter(([, domain]) => domain.state === "available")
    .map(([domain]) => domain);
  const labels: Record<string, string> = {
    skills: "skills",
    quests: "quests",
    diaries: "diaries",
    collectionLog: "clog",
    bossKc: "boss KC",
    slayer: "Slayer",
    accountMode: "account mode",
    bank: "bank"
  };
  const followUps: string[] = [];
  if (player.coverage.collectionLog.state === "not-loaded") followUps.push("open Collection Log once for clog checks");
  if (player.coverage.bossKc.state !== "available") followUps.push("boss KC was not loaded");
  if (player.coverage.slayer.state !== "available") followUps.push("Slayer was not loaded");
  const accepted = `Scan accepted: ${available.map((domain) => labels[domain] ?? domain).join(", ") || "account identity only"}.`;
  return followUps.length > 0 ? `${accepted} Next: ${followUps.join("; ")}.` : accepted;
}

export function pluginBankConnectionLine(player: PluginSyncReceipt, nowMs = Date.now()): string {
  const status = player.bankStatus;
  const coverage = player.coverage?.bank;
  if (coverage?.state === "permission-off") {
    return "Bank sync is off. Scapestack stays conservative about gear and supplies.";
  }
  if (coverage && coverage.state !== "available" && status.enabled && status.itemCount > 0) {
    return `Last bank kept: ${status.itemCount.toLocaleString()} stacks. Open your bank in RuneLite to refresh it.`;
  }
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

export function pluginConnectionView(player: PluginSyncReceipt, nowMs = Date.now()): PluginConnectionView {
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
    instruction: "The accepted scan is now used by your next plan. Anything RuneLite could not read stays unknown instead of being guessed.",
    scanLabel: formatPluginScanLabel(player.syncedAt),
    changedLine: pluginChangedLine(player),
    bankLine: pluginBankConnectionLine(player, nowMs)
  };
}
