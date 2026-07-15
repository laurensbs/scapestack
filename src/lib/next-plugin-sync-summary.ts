import { CURRENT_PLUGIN_VERSION, pluginSyncHealth } from "./plugin-sync";
import type { PathOverview } from "./path-progress";
import { isPluginBankStatusStale, pluginBankStatusLabel, type PluginBankStatus } from "./plugin-bank-status";
import type { SyncDeltaSummary } from "./sync-repo";

export type NextPluginSignalStatus = "exact" | "partial" | "missing" | "refresh" | "update";

export interface NextPluginSignalSummary {
  label: string;
  status: NextPluginSignalStatus;
  value: string;
}

export interface NextPluginSyncSummary {
  state: "live" | "stale" | "outdated";
  title: string;
  body: string;
  syncedAt: string | null;
  bankStatus: PluginBankStatus | null;
  bankStatusLabel: string | null;
  memoryLines: string[];
  xpGainedLabel: string | null;
  signals: NextPluginSignalSummary[];
}

type PluginSource = NonNullable<NonNullable<PathOverview["syncedSources"]>["scapestack"]>;

export function summarizeNextPluginSync(plugin: PluginSource): NextPluginSyncSummary {
  const health = pluginSyncHealth({
    pluginVersion: plugin.pluginVersion,
    syncedAt: plugin.syncedAt
  });

  if (health === "outdated") {
    return {
      state: "outdated",
      title: "Update the RuneLite plugin",
      body: `Your plugin is on v${plugin.pluginVersion ?? "unknown"}. Update to v${CURRENT_PLUGIN_VERSION} so Slayer, diary and collection-log picks stay current.`,
      syncedAt: plugin.syncedAt ?? null,
      bankStatus: plugin.bankStatus ?? null,
      bankStatusLabel: plugin.bankStatus ? pluginBankStatusLabel(plugin.bankStatus) : null,
      memoryLines: syncMemoryLines(plugin.lastSyncSummary),
      xpGainedLabel: syncXpGainedLabel(plugin.lastSyncSummary),
      signals: baseSignals(plugin, "update")
    };
  }

  if (health === "stale") {
    return {
      state: "stale",
      title: "Sync again in RuneLite",
      body: plugin.syncedAt
        ? `Last scan: ${formatScanTime(plugin.syncedAt)}. Press Sync now before spending GP or starting a long grind.`
        : "Last scan: unknown. Press Sync now before spending GP or starting a long grind.",
      syncedAt: plugin.syncedAt ?? null,
      bankStatus: plugin.bankStatus ?? null,
      bankStatusLabel: plugin.bankStatus ? pluginBankStatusLabel(plugin.bankStatus) : null,
      memoryLines: syncMemoryLines(plugin.lastSyncSummary),
      xpGainedLabel: syncXpGainedLabel(plugin.lastSyncSummary),
      signals: baseSignals(plugin, "refresh")
    };
  }

  const clStatus: NextPluginSignalStatus = plugin.clItems > 0 ? "exact" : "partial";
  const bankStatus: NextPluginSignalStatus = plugin.bankStatus?.itemCount
    ? isPluginBankStatusStale(plugin.bankStatus) ? "partial" : "exact"
    : plugin.bankStatus?.enabled ? "partial" : "missing";
  const hasSlayer = plugin.slayerTaskRemaining !== null && plugin.slayerTaskRemaining !== undefined;
  const missing = [
    plugin.clItems > 0 ? null : "open collection-log categories once for item checks",
    hasSlayer ? null : "no live Slayer task yet"
  ].filter(Boolean);

  return {
    state: "live",
    title: missing.length > 0 ? "RuneLite is helping your next trip" : "RuneLite is helping your next trip",
    body: missing.length > 0
      ? `Last scan: ${plugin.syncedAt ? formatScanTime(plugin.syncedAt) : "fresh"}. Skips finished quests and diaries; ${missing.join(", ")}.`
      : `Last scan: ${plugin.syncedAt ? formatScanTime(plugin.syncedAt) : "fresh"}. Skips finished quests, diary tiers, clog slots and Slayer mistakes.`,
    syncedAt: plugin.syncedAt ?? null,
    bankStatus: plugin.bankStatus ?? null,
    bankStatusLabel: plugin.bankStatus ? pluginBankStatusLabel(plugin.bankStatus) : null,
    memoryLines: syncMemoryLines(plugin.lastSyncSummary),
    xpGainedLabel: syncXpGainedLabel(plugin.lastSyncSummary),
    signals: [
      { label: "Quests", status: "exact", value: `${plugin.quests.toLocaleString()} done` },
      { label: "Diaries", status: "exact", value: `${plugin.diaries.toLocaleString()} tiers` },
      { label: "Bank", status: bankStatus, value: bankSignalValue(plugin.bankStatus) },
      { label: "CL", status: clStatus, value: plugin.clItems > 0 ? `${plugin.clItems.toLocaleString()} items` : "open CL" },
      { label: "Slayer", status: hasSlayer ? "exact" : "missing", value: hasSlayer ? `${plugin.slayerTaskRemaining} left` : "not synced" }
    ]
  };
}

function formatScanTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatXp(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M XP`;
  if (value >= 1_000) return `${Math.round(value / 1_000).toLocaleString()}k XP`;
  return `${value.toLocaleString()} XP`;
}

export function syncXpGainedLabel(summary: SyncDeltaSummary | null | undefined): string | null {
  const xp = summary?.skills.reduce((sum, skill) => sum + Math.max(0, skill.xpGained), 0) ?? 0;
  return xp > 0 ? `+${formatXp(xp)} since last scan` : null;
}

export function syncMemoryLines(summary: SyncDeltaSummary | null | undefined): string[] {
  if (!summary) return [];
  const lines: string[] = [];
  const xp = syncXpGainedLabel(summary);
  if (xp) lines.push(xp);
  if (summary.questsCompleted.length > 0) {
    lines.push(`${summary.questsCompleted.length} quest${summary.questsCompleted.length === 1 ? "" : "s"} finished`);
  }
  if (summary.diariesCompleted.length > 0) {
    lines.push(`${summary.diariesCompleted.length} diary tier${summary.diariesCompleted.length === 1 ? "" : "s"} finished`);
  }
  const clogCount = summary.collectionLogItems.length || summary.collectionLogItemIds.length;
  if (clogCount > 0) {
    lines.push(`${clogCount} clog slot${clogCount === 1 ? "" : "s"} added`);
  }
  if (summary.bank) {
    if (summary.bank.currentItemCount > 0) {
      lines.push(`Bank snapshot: ${summary.bank.currentItemCount.toLocaleString()} stacks`);
    } else if (summary.bank.currentUnavailableReason === "bank-not-opened-this-session") {
      lines.push("Open bank in RuneLite, then sync again");
    } else if (summary.bank.currentUnavailableReason === "opt-in-off") {
      lines.push("RuneLite bank is off");
    }
  }
  if (summary.accountType.changed) {
    lines.push("Account mode updated");
  }
  return lines.slice(0, 4);
}

function baseSignals(plugin: PluginSource, status: Extract<NextPluginSignalStatus, "refresh" | "update">): NextPluginSignalSummary[] {
  return [
    { label: "Quests", status, value: `${plugin.quests.toLocaleString()} done` },
    { label: "Diaries", status, value: `${plugin.diaries.toLocaleString()} tiers` },
    { label: "Bank", status, value: bankSignalValue(plugin.bankStatus) },
    { label: "CL", status, value: `${plugin.clItems.toLocaleString()} items` },
    {
      label: "Slayer",
      status,
      value: plugin.slayerTaskRemaining !== null && plugin.slayerTaskRemaining !== undefined
        ? `${plugin.slayerTaskRemaining} left`
        : "not synced"
    }
  ];
}

function bankSignalValue(bankStatus: PluginBankStatus | null | undefined): string {
  if (!bankStatus) return "unknown";
  return pluginBankStatusLabel(bankStatus).replace(/^Bank ready: /, "");
}
