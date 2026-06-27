import { CURRENT_PLUGIN_VERSION, pluginSyncHealth } from "./plugin-sync";
import type { PathOverview } from "./path-progress";

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
      title: "Update Scapestack Sync",
      body: `Last sync used v${plugin.pluginVersion ?? "unknown"}. Update to v${CURRENT_PLUGIN_VERSION} so Slayer, diary and collection-log picks stay current.`,
      signals: baseSignals(plugin, "update")
    };
  }

  if (health === "stale") {
    return {
      state: "stale",
      title: "Refresh Scapestack Sync",
      body: "Your last sync is old. Refresh RuneLite before spending GP or starting a long grind.",
      signals: baseSignals(plugin, "refresh")
    };
  }

  const clStatus: NextPluginSignalStatus = plugin.clItems > 0 ? "exact" : "partial";
  const hasSlayer = plugin.slayerTaskRemaining !== null && plugin.slayerTaskRemaining !== undefined;
  const missing = [
    plugin.clItems > 0 ? null : "open collection-log categories once for item checks",
    hasSlayer ? null : "no live Slayer task yet"
  ].filter(Boolean);

  return {
    state: "live",
    title: missing.length > 0 ? "RuneLite sync ready" : "RuneLite sync fresh",
    body: missing.length > 0
      ? `Quests and diaries are synced; ${missing.join(", ")}.`
      : "Quests, diaries, collection log and Slayer are coming from your RuneLite client.",
    signals: [
      { label: "Quests", status: "exact", value: `${plugin.quests.toLocaleString()} done` },
      { label: "Diaries", status: "exact", value: `${plugin.diaries.toLocaleString()} tiers` },
      { label: "CL", status: clStatus, value: plugin.clItems > 0 ? `${plugin.clItems.toLocaleString()} items` : "open CL" },
      { label: "Slayer", status: hasSlayer ? "exact" : "missing", value: hasSlayer ? `${plugin.slayerTaskRemaining} left` : "not synced" }
    ]
  };
}

function baseSignals(plugin: PluginSource, status: Extract<NextPluginSignalStatus, "refresh" | "update">): NextPluginSignalSummary[] {
  return [
    { label: "Quests", status, value: `${plugin.quests.toLocaleString()} done` },
    { label: "Diaries", status, value: `${plugin.diaries.toLocaleString()} tiers` },
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
