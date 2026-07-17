export const CURRENT_PLUGIN_VERSION = "0.3.0";

export type PluginSyncHealth = "live" | "stale" | "outdated";

function parseVersion(version: string | undefined | null): number[] {
  if (!version) return [];
  return version
    .trim()
    .replace(/^v/i, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

export function isPluginVersionAtLeast(version: string | undefined | null, minimum = CURRENT_PLUGIN_VERSION): boolean {
  const actual = parseVersion(version);
  const required = parseVersion(minimum);
  if (actual.length === 0) return false;

  for (let index = 0; index < Math.max(actual.length, required.length); index++) {
    const actualPart = actual[index] ?? 0;
    const requiredPart = required[index] ?? 0;
    if (actualPart > requiredPart) return true;
    if (actualPart < requiredPart) return false;
  }

  return true;
}

export function pluginSyncHealth(input: {
  pluginVersion?: string | null;
  syncedAt?: string | null;
  staleAfterHours?: number;
}): PluginSyncHealth {
  if (!isPluginVersionAtLeast(input.pluginVersion)) return "outdated";

  const syncedAtMs = input.syncedAt ? new Date(input.syncedAt).getTime() : Number.NaN;
  if (!Number.isFinite(syncedAtMs)) return "stale";

  const staleAfterHours = input.staleAfterHours ?? 24;
  const hoursOld = (Date.now() - syncedAtMs) / (1000 * 60 * 60);
  return hoursOld >= staleAfterHours ? "stale" : "live";
}
