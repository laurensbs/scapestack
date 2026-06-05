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
      title: "RuneLite plugin update needed",
      body: `Synced with v${plugin.pluginVersion ?? "unknown"}. Update to v${CURRENT_PLUGIN_VERSION} before trusting newer Slayer and coverage fields.`,
      signals: baseSignals(plugin, "update")
    };
  }

  if (health === "stale") {
    return {
      state: "stale",
      title: "RuneLite plugin stale",
      body: "Plugin data exists, but this payload is old. Refresh RuneLite sync before trusting verified coverage labels.",
      signals: baseSignals(plugin, "refresh")
    };
  }

  const clStatus: NextPluginSignalStatus = plugin.clItems > 0 ? "exact" : "partial";
  const hasSlayer = plugin.slayerTaskRemaining !== null && plugin.slayerTaskRemaining !== undefined;
  const missing = [
    plugin.clItems > 0 ? null : "collection log needs opened categories",
    hasSlayer ? null : "Slayer is still inferred"
  ].filter(Boolean);

  return {
    state: "live",
    title: missing.length > 0 ? "Verified RuneLite payload with partial coverage" : "Verified RuneLite payload live",
    body: missing.length > 0
      ? `Quest and diary state are verified from RuneLite; ${missing.join(", ")}.`
      : "Verified quest, diary, collection-log and Slayer state are coming from your RuneLite client.",
    signals: [
      { label: "Quests", status: "exact", value: `${plugin.quests.toLocaleString()} done` },
      { label: "Diaries", status: "exact", value: `${plugin.diaries.toLocaleString()} tiers` },
      { label: "CL", status: clStatus, value: plugin.clItems > 0 ? `${plugin.clItems.toLocaleString()} IDs` : "open CL" },
      { label: "Slayer", status: hasSlayer ? "exact" : "missing", value: hasSlayer ? `${plugin.slayerTaskRemaining} left` : "inferred" }
    ]
  };
}

function baseSignals(plugin: PluginSource, status: Extract<NextPluginSignalStatus, "refresh" | "update">): NextPluginSignalSummary[] {
  return [
    { label: "Quests", status, value: `${plugin.quests.toLocaleString()} done` },
    { label: "Diaries", status, value: `${plugin.diaries.toLocaleString()} tiers` },
    { label: "CL", status, value: `${plugin.clItems.toLocaleString()} IDs` },
    {
      label: "Slayer",
      status,
      value: plugin.slayerTaskRemaining !== null && plugin.slayerTaskRemaining !== undefined
        ? `${plugin.slayerTaskRemaining} left`
        : "inferred"
    }
  ];
}
