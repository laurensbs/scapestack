import { CURRENT_PLUGIN_CONTRACT_VERSION } from "./plugin-sync";
import type { PluginBankStatus } from "./plugin-bank-status";
import type { PluginSnapshotCoverage } from "./plugin-snapshot-contract";
import type { SyncedPlayer } from "./sync-repo";

/**
 * Privacy-minimized readback for browser polling. The planner reads the full
 * snapshot on the server; browser status checks only need proof that the
 * claimed plugin write was accepted and which domains were available.
 */
export interface PluginSyncReceipt {
  rsn: string;
  displayName: string;
  syncedAt: string;
  pluginVersion: string;
  contractVersion: number | null;
  claim: { status: "verified"; rsn: string };
  coverage: PluginSnapshotCoverage | null;
  counts: {
    skills: number;
    quests: number;
    diaries: number;
    collectionLogItems: number;
    bossKc: number;
    bankItems: number;
    slayer: number;
  };
  bankStatus: PluginBankStatus;
}

export function pluginSyncReceipt(player: SyncedPlayer): PluginSyncReceipt {
  return {
    rsn: player.rsn,
    displayName: player.displayName,
    syncedAt: player.syncedAt,
    pluginVersion: player.pluginVersion,
    contractVersion: player.snapshotCoverage ? CURRENT_PLUGIN_CONTRACT_VERSION : null,
    claim: { status: "verified", rsn: player.rsn },
    coverage: player.snapshotCoverage ?? null,
    counts: {
      skills: player.skills.length,
      quests: player.questsCompleted.length,
      diaries: player.diariesCompleted.length,
      collectionLogItems: player.collectionLogItemIds.length,
      bossKc: Object.keys(player.bossKc ?? {}).length,
      bankItems: player.bankItems.length,
      slayer: player.slayer ? 1 : 0
    },
    bankStatus: player.bankStatus
  };
}
