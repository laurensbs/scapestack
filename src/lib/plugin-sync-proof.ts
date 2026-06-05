import type { SyncedPlayer } from "./sync-repo";
import { nextUrlForSyncedRsn, slayerUrlForSyncedRsn } from "./plugin-sync-actions";

export function formatPluginSyncProof(player: SyncedPlayer): string {
  const displayName = player.displayName || player.rsn;
  const slayer = player.slayer
    ? [
        `Task ID: ${player.slayer.currentTaskId || "none"}`,
        `Remaining: ${player.slayer.taskRemaining}`,
        `Points: ${player.slayer.points}`,
        `Streak: ${player.slayer.streak}`,
        `Blocks: ${player.slayer.blocks.length}`
      ].join(" · ")
    : "No Slayer payload";

  return [
    "Scapestack Sync proof",
    "",
    `RSN: ${displayName}`,
    `Synced at: ${player.syncedAt}`,
    `Plugin version: v${player.pluginVersion || "unknown"}`,
    `Quests completed: ${player.questsCompleted.length}`,
    `Diary tiers completed: ${player.diariesCompleted.length}`,
    `Collection-log item IDs: ${player.collectionLogItemIds.length}`,
    `Slayer: ${slayer}`,
    "",
    "Not included: account login, bank, inventory, equipment, chat, screenshots, clicks, keys, install token."
  ].join("\n");
}

export interface PluginSyncChecklistContext {
  origin?: string | null;
}

export function formatPluginSyncSessionChecklist(
  player: SyncedPlayer,
  context: PluginSyncChecklistContext = {}
): string {
  const displayName = player.displayName || player.rsn;
  const nextUrl = absoluteAppUrl(nextUrlForSyncedRsn(displayName), context.origin);
  const slayerUrl = absoluteAppUrl(slayerUrlForSyncedRsn(displayName), context.origin);
  const bankUrl = absoluteAppUrl(`/bank?rsn=${encodeURIComponent(displayName)}&from=plugin`, context.origin);
  const hasCollectionLog = player.collectionLogItemIds.length > 0;
  const slayerLine = player.slayer
    ? `Route live Slayer: task ID ${player.slayer.currentTaskId || "none"}, ${player.slayer.taskRemaining} left, ${player.slayer.points} points, ${player.slayer.streak} streak. ${slayerUrl}`
    : "Refresh Slayer state in RuneLite before trusting task routing.";
  const collectionLogLine = hasCollectionLog
    ? `Collection log suppression is active with ${player.collectionLogItemIds.length} synced item ID${player.collectionLogItemIds.length === 1 ? "" : "s"}.`
    : "Open Collection Log categories in RuneLite, sync again, then re-check CL suppression.";

  return [
    "Scapestack RuneLite session checklist",
    "",
    `RSN: ${displayName}`,
    `Plugin payload: v${player.pluginVersion || "unknown"} at ${player.syncedAt}`,
    "",
    `1. Open /next with source=plugin-sync and bank=none for verified account-state planning. ${nextUrl}`,
    `2. ${slayerLine}`,
    `3. ${collectionLogLine}`,
    `4. Paste Bank Memory or Bank Tags in the browser when you need GP value, gear, item IDs or DPS affordability. ${bankUrl}`,
    "5. Re-check sync after quest completions, diary tiers, Collection Log browsing, or Slayer task changes.",
    "",
    "Boundary: RuneLite sync does not include bank, inventory, equipment, chat, screenshots, clicks, keys, account login or install token."
  ].join("\n");
}

function absoluteAppUrl(path: string, origin?: string | null): string {
  const cleanOrigin = origin?.trim();
  if (!cleanOrigin) return path;
  try {
    return new URL(path, cleanOrigin).toString();
  } catch {
    return path;
  }
}
