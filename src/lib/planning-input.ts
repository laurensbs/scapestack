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
  collectionLogOwnedItemIds?: number[];
  scapestackSync: SyncedPlayer | null;
  bankOverride?: NextUpInput["bank"];
  questCompletionAnswers?: NextUpInput["questCompletionAnswers"];
}

function domainAvailable(
  player: SyncedPlayer | null,
  domain: keyof NonNullable<SyncedPlayer["availability"]>
): boolean {
  const state = player?.availability?.[domain];
  // Legacy snapshots predate explicit coverage. Preserve their established
  // behavior; v3 snapshots must earn authority per domain.
  return state === undefined || state === "available";
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
/**
 * The Hiscores activity list is not a boss list.
 *
 * Its first twenty entries are points, ranks, clue counts and scores — and
 * "Colosseum Glory" alone reads 36,582 on a real account. Copying all of them
 * into bossKc made the total blow past bossRecs' 1,000-KC "this player has
 * done plenty of bossing" cutoff for essentially every established account,
 * so a returning player got zero boss suggestions and no explanation.
 *
 * Clue tiers are excluded for a second reason: "Clue Scrolls (all)" double
 * counts every tier beneath it.
 */
const NON_BOSS_ACTIVITY = /^(?:Grid Points|League Points|Deadman Points|Bounty Hunter|Clue Scrolls|LMS - Rank|PvP Arena - Rank|Soul Wars Zeal|Rifts closed|Colosseum Glory|Collections Logged)/i;

function isBossActivity(name: string): boolean {
  return !NON_BOSS_ACTIVITY.test(name.trim());
}

export function buildNextUpInputFromSources(sources: PlanningInputSources): NextUpInput | null {
  const { rsn, hiscores, wom, scapestackSync } = sources;
  const skills = hiscores?.skills ?? syncedSkillsToHiscoreSkills(
    domainAvailable(scapestackSync, "skills") ? scapestackSync?.skills : undefined
  );
  const usePluginBank = sources.bankOverride === undefined && shouldUsePluginBank({
    status: scapestackSync?.bankStatus,
    itemCount: scapestackSync?.bankItems.length ?? 0,
    availability: scapestackSync?.availability?.bank
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
  // The OSRS Hiscores do not expose quest points at all — there is no such
  // activity in the response — so this lookup has always come back empty and
  // the old `: 0` fallback made every RSN-only account look like it had done
  // nothing. null means "we do not know", which the consumers treat as
  // permissive instead of as proof of zero. The lookup stays in case Jagex
  // ever adds it.
  const qpActivity = hiscores?.activities.find((activity) => activity.name === "Quest points");
  const questPoints = qpActivity && qpActivity.score >= 0 ? qpActivity.score : null;
  const bossKc: Record<string, number> = {
    ...(domainAvailable(scapestackSync, "bossKc") ? scapestackSync?.bossKc ?? {} : {})
  };
  for (const activity of hiscores?.activities ?? []) {
    if (activity.score > 0 && isBossActivity(activity.name)) {
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
    collectionLogOwnedItemIds: sources.collectionLogOwnedItemIds,
    questCompletionAnswers: sources.questCompletionAnswers,
    scapestackSync: scapestackSync
      ? {
          displayName: scapestackSync.displayName,
          accountType: scapestackSync.accountType,
          questsCompleted: domainAvailable(scapestackSync, "quests")
            ? scapestackSync.questsCompleted : undefined,
          diariesCompleted: domainAvailable(scapestackSync, "diaries")
            ? scapestackSync.diariesCompleted : undefined,
          collectionLogItemIds: domainAvailable(scapestackSync, "collectionLog")
            ? scapestackSync.collectionLogItemIds : undefined,
          bossKc: domainAvailable(scapestackSync, "bossKc")
            ? scapestackSync.bossKc : undefined,
          bankStatus: scapestackSync.bankStatus,
          lastSyncSummary: scapestackSync.lastSyncSummary,
          slayer: domainAvailable(scapestackSync, "slayer")
            ? scapestackSync.slayer : undefined
        }
      : undefined,
    syncedSources: {
      wom: wom !== null,
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
            availability: scapestackSync.availability,
            lastSyncSummary: scapestackSync.lastSyncSummary
          }
        : null
    }
  };
}
