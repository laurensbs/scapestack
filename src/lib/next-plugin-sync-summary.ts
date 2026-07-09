import { CURRENT_PLUGIN_VERSION, pluginSyncHealth } from "./plugin-sync";
import type { PathOverview } from "./path-progress";
import { isPluginBankStatusStale, pluginBankStatusLabel, type PluginBankStatus } from "./plugin-bank-status";

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
      signals: baseSignals(plugin, "update")
    };
  }

  if (health === "stale") {
    return {
      state: "stale",
      title: "Sync again in RuneLite",
      body: plugin.syncedAt
        ? `Last RuneLite scan: ${new Date(plugin.syncedAt).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}. Sync again before spending GP or starting a long grind.`
        : "Last RuneLite scan: check again before spending GP or starting a long grind.",
      syncedAt: plugin.syncedAt ?? null,
      bankStatus: plugin.bankStatus ?? null,
      bankStatusLabel: plugin.bankStatus ? pluginBankStatusLabel(plugin.bankStatus) : null,
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
    title: missing.length > 0 ? "RuneLite is connected" : "RuneLite is up to date",
    body: missing.length > 0
      ? `Your next trip can skip finished quests and diaries; ${missing.join(", ")}.`
      : "Your next trip can use finished quests, diary tiers, collection log and Slayer from RuneLite.",
    syncedAt: plugin.syncedAt ?? null,
    bankStatus: plugin.bankStatus ?? null,
    bankStatusLabel: plugin.bankStatus ? pluginBankStatusLabel(plugin.bankStatus) : null,
    signals: [
      { label: "Quests", status: "exact", value: `${plugin.quests.toLocaleString()} done` },
      { label: "Diaries", status: "exact", value: `${plugin.diaries.toLocaleString()} tiers` },
      { label: "Bank", status: bankStatus, value: plugin.bankStatus ? pluginBankStatusLabel(plugin.bankStatus).replace(/^Bank synced: /, "") : "unknown" },
      { label: "CL", status: clStatus, value: plugin.clItems > 0 ? `${plugin.clItems.toLocaleString()} items` : "open CL" },
      { label: "Slayer", status: hasSlayer ? "exact" : "missing", value: hasSlayer ? `${plugin.slayerTaskRemaining} left` : "not synced" }
    ]
  };
}

function baseSignals(plugin: PluginSource, status: Extract<NextPluginSignalStatus, "refresh" | "update">): NextPluginSignalSummary[] {
  return [
    { label: "Quests", status, value: `${plugin.quests.toLocaleString()} done` },
    { label: "Diaries", status, value: `${plugin.diaries.toLocaleString()} tiers` },
    { label: "Bank", status, value: plugin.bankStatus ? pluginBankStatusLabel(plugin.bankStatus).replace(/^Bank synced: /, "") : "unknown" },
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
