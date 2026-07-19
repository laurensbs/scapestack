import { scapestackAccountTypeToPlannerType } from "@/lib/account-type";
import { unlockedFromHiscores } from "@/lib/goals";
import type { PlayerHiscores } from "@/lib/hiscores";
import type { NextUpInput } from "@/lib/next-up";
import { shouldUsePluginBank } from "@/lib/plugin-bank-status";
import type { SyncedPlayer } from "@/lib/sync-repo";
import type { WomPlayer } from "@/lib/wom";

interface PlanningInputSources {
  rsn: string;
  hiscores: PlayerHiscores | null;
  wom: WomPlayer | null;
  templeQuestsCompleted?: string[];
  collectionLogOwnedItemIds?: number[];
  scapestackSync: SyncedPlayer | null;
  bankOverride?: NextUpInput["bank"];
}

function syncedSkillsToHiscoreSkills(
  skills: Array<{ name: string; level: number }> | undefined
): PlayerHiscores["skills"] {
  if (!skills?.length) return [];
  const rows = skills.map((skill, index) => ({
    id: index + 1,
    name: skill.name,
    rank: 0,
    level: skill.level,
    xp: 0
  }));
  const totalLevel = rows.reduce((sum, skill) => sum + skill.level, 0);
  return [{ id: 0, name: "Overall", rank: 0, level: totalLevel, xp: 0 }, ...rows];
}

/**
 * Builds the recommendation engine input once for both the fast RSN path and
 * explicit browser-bank overrides. Keeping source priority here prevents the
 * two paths from producing different advice from the same account snapshot.
 */
export function buildNextUpInputFromSources(sources: PlanningInputSources): NextUpInput | null {
  const { rsn, hiscores, wom, scapestackSync } = sources;
  const skills = hiscores?.skills ?? syncedSkillsToHiscoreSkills(scapestackSync?.skills);
  const usePluginBank = sources.bankOverride === undefined && shouldUsePluginBank({
    status: scapestackSync?.bankStatus,
    itemCount: scapestackSync?.bankItems.length ?? 0
  });
  const bank = sources.bankOverride ?? (usePluginBank && scapestackSync
    ? scapestackSync.bankItems.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity
      }))
    : []);
  if (skills.length === 0 && bank.length === 0) return null;

  const seenBankIds = new Set(bank.map((item) => item.id));
  const earnedItems = unlockedFromHiscores(skills).filter((item) => !seenBankIds.has(item.id));
  const qpActivity = hiscores?.activities.find((activity) => activity.name === "Quest points");
  const questPoints = qpActivity && qpActivity.score >= 0 ? qpActivity.score : 0;
  const bossKc: Record<string, number> = { ...(scapestackSync?.bossKc ?? {}) };
  for (const activity of hiscores?.activities ?? []) {
    if (activity.score > 0) {
      bossKc[activity.name] = Math.max(bossKc[activity.name] ?? 0, activity.score);
    }
  }

  const accountMeta: NextUpInput["accountMeta"] = scapestackSync || wom
    ? {
        displayName: wom?.displayName ?? scapestackSync?.displayName ?? rsn,
        accountType: scapestackSync
          ? scapestackAccountTypeToPlannerType(scapestackSync.accountType)
          : wom!.accountType,
        ehp: wom?.ehp ?? 0,
        ehb: wom?.ehb ?? 0,
        lastChangedAt: wom?.lastChangedAt ?? null
      }
    : null;

  return {
    skills,
    bank,
    earnedItems,
    questPoints,
    bossKc,
    womBossKills: wom?.bossKills,
    accountMeta,
    templeQuestsCompleted: sources.templeQuestsCompleted,
    collectionLogOwnedItemIds: sources.collectionLogOwnedItemIds,
    scapestackSync: scapestackSync
      ? {
          displayName: scapestackSync.displayName,
          accountType: scapestackSync.accountType,
          questsCompleted: scapestackSync.questsCompleted,
          diariesCompleted: scapestackSync.diariesCompleted,
          collectionLogItemIds: scapestackSync.collectionLogItemIds,
          bossKc: scapestackSync.bossKc,
          bankStatus: scapestackSync.bankStatus,
          lastSyncSummary: scapestackSync.lastSyncSummary,
          slayer: scapestackSync.slayer
        }
      : undefined,
    syncedSources: {
      wom: wom !== null,
      temple: sources.templeQuestsCompleted !== undefined,
      collectionLog: sources.collectionLogOwnedItemIds !== undefined,
      scapestack: scapestackSync
        ? {
            syncedAt: scapestackSync.syncedAt,
            quests: scapestackSync.questsCompleted.length,
            diaries: scapestackSync.diariesCompleted.length,
            clItems: scapestackSync.collectionLogItemIds.length,
            pluginVersion: scapestackSync.pluginVersion,
            slayerTaskRemaining: scapestackSync.slayer?.taskRemaining ?? null,
            slayerBlocks: scapestackSync.slayer?.blocks.length ?? 0,
            bankStatus: scapestackSync.bankStatus,
            lastSyncSummary: scapestackSync.lastSyncSummary
          }
        : null
    }
  };
}
