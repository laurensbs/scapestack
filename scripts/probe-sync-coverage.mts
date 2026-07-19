import { getSyncedPlayer } from "../src/lib/sync-repo.ts";

const rsn = process.argv[2]?.trim();
if (!rsn) {
  console.error("Usage: npx tsx scripts/probe-sync-coverage.mts <rsn>");
  process.exit(2);
}

const player = await getSyncedPlayer(rsn);
if (!player) {
  console.log(JSON.stringify({ found: false, rsn }, null, 2));
  process.exit(1);
}

const bankStatus = player.bankStatus;
const coverage = player.snapshotCoverage ?? null;

console.log(JSON.stringify({
  found: true,
  rsn: player.rsn,
  displayName: player.displayName,
  syncedAt: player.syncedAt,
  pluginVersion: player.pluginVersion,
  accountType: player.accountType,
  coverage,
  counts: {
    skills: player.skills.length,
    quests: player.questsCompleted.length,
    diaries: player.diariesCompleted.length,
    collectionLogItems: player.collectionLogItemIds.length,
    bossKc: Object.keys(player.bossKc ?? {}).length,
    bankItems: player.bankItems.length
  },
  bank: {
    enabled: bankStatus.enabled,
    itemCount: bankStatus.itemCount,
    capturedAt: bankStatus.capturedAt,
    unavailableReason: bankStatus.unavailableReason
  },
  slayer: player.slayer
    ? {
        available: true,
        hasCurrentTask: Boolean(player.slayer.taskName || player.slayer.currentTaskId),
        blockCount: player.slayer.blocks.length
      }
    : { available: false }
}, null, 2));
