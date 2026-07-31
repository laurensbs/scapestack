import Link from "next/link";
import { notFound } from "next/navigation";
import { BankObservationsPanel } from "@/components/bank-observations-panel";
import { LastTripLine } from "@/components/last-trip-line";
import { PlayerHubShell } from "@/components/player-hub-shell";
import { PinnedGoalsPanel } from "@/components/pinned-goals-panel";
import { PlayerPlanPanel } from "@/components/player-plan-panel";
import { PlayerSkillsTable } from "@/components/player-skills-table";
import { PlayerToolsSections } from "@/components/player-tools-sections";
import {
  isIronPlannerAccount,
  plannerAccountTypeLabel,
  scapestackAccountTypeToPlannerType
} from "@/lib/account-type";
import { buildAffordabilityReport, tradeableIndex } from "@/lib/bank-affordability";
import { BOSSES, isNonCombatBossActivity } from "@/lib/bosses";
import { bossViabilityFromSimpleBank } from "@/lib/boss-viability";
import { combatStatsFromSkills } from "@/lib/dps";
import { fetchHiscores, formatXp, computeCombatLevel, computeTotalLevel, totalXp } from "@/lib/hiscores";
import { buildMoneyMethodFilter } from "@/lib/money-methods";
import { loadPlanningContext } from "@/lib/planning-context";
import { pluginSyncHealth } from "@/lib/plugin-sync";
import { shouldUsePluginBank } from "@/lib/plugin-bank-status";
import { pluginVerifyUrlForSyncedRsn } from "@/lib/plugin-sync-actions";
import { buildPinnedGoalEvidence } from "@/lib/pinned-goal-evidence";
import { getQuests } from "@/lib/quest-db";
import { cleanRsnInput, normalizeRsn } from "@/lib/rsn";
import { decideSlayerTask } from "@/lib/slayer-task-decision";
import { MONSTERS_BY_ID } from "@/lib/slayer/monsters";
import { resolveSlayerTaskMonsterId } from "@/lib/slayer/task-ids";
import { resolveViewerRsn } from "@/lib/viewer-account";
import { getLatestPrices, getWikiItemMapping } from "@/lib/wiki";
import { isRedactedSyncedPlayer } from "@/lib/synced-player-visibility";

interface Props {
  params: Promise<{ rsn: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Props) {
  const { rsn } = await params;
  const decoded = cleanRsnInput(decodeURIComponent(rsn));
  const hi = await fetchHiscores(decoded);
  if (!hi) return { title: `${decoded} · Scapestack` };
  const combat = computeCombatLevel(hi.skills);
  const total = computeTotalLevel(hi.skills);
  return {
    title: `${hi.name} · ${total} total · ${combat} cb`,
    description: `${hi.name}'s Scapestack player page — one next trip, bank context and ${formatXp(totalXp(hi.skills))} XP.`
  };
}

export default async function PlayerPage({ params, searchParams }: Props) {
  const resolvedSearchParams = searchParams
    ?? Promise.resolve({} as Record<string, string | string[] | undefined>);
  const [{ rsn }, query, viewerRsn] = await Promise.all([
    params,
    resolvedSearchParams,
    resolveViewerRsn()
  ]);
  const decoded = cleanRsnInput(decodeURIComponent(rsn)).slice(0, 12);
  const sourceValue = query.source;
  const fromValue = query.from;
  const source = (Array.isArray(sourceValue) ? sourceValue[0] : sourceValue)?.trim().toLowerCase();
  const from = (Array.isArray(fromValue) ? fromValue[0] : fromValue)?.trim().toLowerCase();
  const isOwner = viewerRsn === normalizeRsn(decoded);
  const [context, latestPrices, wikiMapping, quests] = await Promise.all([
    loadPlanningContext(decoded, {
      viewerRsn,
      preferScapestack: source === "plugin-sync" || from === "plugin"
    }).catch(() => null),
    isOwner ? getLatestPrices().catch(() => new Map()) : Promise.resolve(new Map()),
    isOwner ? getWikiItemMapping().catch(() => new Map()) : Promise.resolve(new Map()),
    getQuests()
  ]);
  const hi = context?.hiscores;
  if (!context || !hi) notFound();
  const taskProjection = context.slayerTask;

  const displayName = hi.name;
  const accountMode = context.initialPlan?.summary.accountMode.type
    ?? (context.scapestackSync ? scapestackAccountTypeToPlannerType(context.scapestackSync.accountType) : null);
  const accountType = accountMode ? plannerAccountTypeLabel(accountMode) : "Account type unknown";
  const syncedAt = context.scapestackSync?.syncedAt ?? null;
  const bankItems = context.scapestackSync?.bankItems ?? [];
  const exactSync = isOwner && context.scapestackSync && !isRedactedSyncedPlayer(context.scapestackSync)
    ? context.scapestackSync
    : null;
  const exactDomain = (domain: "quests" | "diaries") => {
    const availability = exactSync?.availability?.[domain];
    return Boolean(exactSync && (availability === undefined || availability === "available"));
  };
  const exactBank = exactSync && shouldUsePluginBank({
    status: exactSync.bankStatus,
    itemCount: exactSync.bankItems.length,
    availability: exactSync.availability?.bank
  }) ? exactSync.bankItems : undefined;
  const goalEvidence = buildPinnedGoalEvidence({
    skills: hi.skills,
    quests,
    questsCompleted: exactDomain("quests") ? exactSync?.questsCompleted : undefined,
    diariesCompleted: exactDomain("diaries") ? exactSync?.diariesCompleted : undefined,
    bankItems: exactBank
  });
  const cannotBuy = isIronPlannerAccount(accountMode);
  const simpleBank = bankItems.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity }));
  const numericPrices = new Map(
    [...latestPrices].map(([id, price]) => [id, price.value] as const)
  );
  const bosses = bankItems.length > 0
    ? BOSSES
        .filter((boss) => !isNonCombatBossActivity(boss))
        .map((boss) => bossViabilityFromSimpleBank(simpleBank, boss, combatStatsFromSkills(hi.skills)))
        .filter((boss): boss is NonNullable<typeof boss> => boss !== null)
    : null;
  const sets = bankItems.length > 0
    ? buildAffordabilityReport(simpleBank, latestPrices, tradeableIndex(wikiMapping))
    : null;
  const moneyMethods = bankItems.length > 0
    ? buildMoneyMethodFilter({
        skills: hi.skills,
        questsCompleted: context.scapestackSync?.questsCompleted ?? [],
        bank: bankItems,
        prices: numericPrices,
        cannotBuy
      })
    : null;
  const slayerState = taskProjection?.slayer ?? null;
  const slayerSlug = slayerState
    ? resolveSlayerTaskMonsterId(slayerState.taskName, slayerState.currentTaskId)
    : null;
  const slayerMonster = slayerSlug ? MONSTERS_BY_ID.get(slayerSlug) ?? null : null;
  const slayerDecision = slayerState && slayerState.taskRemaining > 0 && slayerMonster
    ? decideSlayerTask({
        task: slayerMonster,
        state: slayerState,
        bank: simpleBank,
        accountType: accountMode,
        combatLevel: computeCombatLevel(hi.skills),
        slayerLevel: hi.skills.find((skill) => skill.name.toLowerCase() === "slayer")?.level ?? 1,
        syncHealth: pluginSyncHealth({
          pluginVersion: taskProjection?.pluginVersion,
          syncedAt: taskProjection?.syncedAt,
          staleAfterHours: 6
        })
      })
    : null;
  const emptyTaskReason = !taskProjection
    ? "No RuneLite Slayer scan is available for this player."
    : !slayerState || slayerState.taskRemaining <= 0
      ? "RuneLite is connected, but no active Slayer task was found."
      : "RuneLite found a current task, but this older scan does not include a task name Scapestack can resolve yet.";
  const syncHref = pluginVerifyUrlForSyncedRsn(displayName, "profile", {
    hasBankContext: bankItems.length > 0
  });

  const header = (
    <header className="mb-5 border-b border-[var(--color-border)] pb-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-4xl font-semibold leading-none text-[var(--color-text)] sm:text-6xl">
            {displayName}
          </h1>
          <p className="mt-2 text-[12.5px] text-[var(--color-text-muted)]">
            {accountType} · {formatSyncAge(syncedAt)}
          </p>
        </div>
        <Link href={syncHref} className="btn-ghost min-h-11 w-fit shrink-0 px-4 text-[12px] font-bold">
          Sync
        </Link>
      </div>
    </header>
  );

  const bank = (
    <section className="mt-10 border-t border-[var(--color-border)] pt-6" aria-labelledby="player-bank-title">
      <h2 id="player-bank-title" className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
        Your bank
      </h2>
      <BankObservationsPanel result={context.bankObservations} />
      {bankItems.length === 0 && (
        <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
          Bank details stay private. Pair this browser and sync RuneLite to use your bank here.
        </p>
      )}
    </section>
  );

  const tools = (
    <PlayerToolsSections
      rsn={displayName}
      skills={hi.skills}
      questsCompleted={context.scapestackSync?.questsCompleted ?? []}
      cannotBuy={cannotBuy}
      canShareBank={isOwner && sets !== null && !cannotBuy}
      bosses={bosses}
      sets={sets}
      task={slayerDecision}
      emptyTaskReason={emptyTaskReason}
      money={moneyMethods}
    />
  );

  return (
    <PlayerHubShell
      header={header}
      lastTrip={<LastTripLine outcome={context.lastTripOutcome} />}
      goals={<PinnedGoalsPanel rsn={displayName} evidence={goalEvidence} canSync={isOwner} />}
      plan={<PlayerPlanPanel rsn={displayName} initialContext={context} />}
      bank={bank}
      tools={tools}
      account={<PlayerSkillsTable displayName={displayName} skills={hi.skills} />}
    />
  );
}

export function formatSyncAge(syncedAt: string | null, now = Date.now()): string {
  if (!syncedAt) return "not synced";
  const timestamp = new Date(syncedAt).getTime();
  if (!Number.isFinite(timestamp)) return "sync time unknown";
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return "synced just now";
  if (minutes < 60) return `synced ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `synced ${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `synced ${days} day${days === 1 ? "" : "s"} ago`;
}
