import Link from "next/link";
import { notFound } from "next/navigation";
import { BankObservationsPanel } from "@/components/bank-observations-panel";
import { LastTripLine } from "@/components/last-trip-line";
import { PlayerHubShell } from "@/components/player-hub-shell";
import { PlayerIdentityBand } from "@/components/player-identity-band";
import { PinnedGoalsPanel } from "@/components/pinned-goals-panel";
import { PlayerPlanPanel } from "@/components/player-plan-panel";
import { PlayerRoutesPanel } from "@/components/player-routes-panel";
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
import { getDropRates } from "@/lib/drop-rates-db";
import { getItems } from "@/lib/item-db";
import { pluginVerifyUrlForSyncedRsn } from "@/lib/plugin-sync-actions";
import { buildPinnedGoalEvidence } from "@/lib/pinned-goal-evidence";
import { pinnedGoalSuggestionsFromPlan } from "@/lib/pinned-goal-suggestions";
import {
  buildPinnedGoalBankFacts,
  buildPinnedGoalBossSources
} from "@/lib/pinned-goal-orientation";
import { getQuests } from "@/lib/quest-db";
import { getDiaries, type DiaryTier } from "@/lib/diary-db";
import { cleanRsnInput, normalizeRsn } from "@/lib/rsn";
import { decideSlayerTask } from "@/lib/slayer-task-decision";
import { MONSTERS_BY_ID } from "@/lib/slayer/monsters";
import { resolveSlayerTaskMonsterId } from "@/lib/slayer/task-ids";
import { resolveViewerRsn } from "@/lib/viewer-account";
import { getLatestPrices, getWikiItemMapping } from "@/lib/wiki";
import { isRedactedSyncedPlayer } from "@/lib/synced-player-visibility";
import { buildCollectionLogRoute, buildMaxRoute } from "@/lib/companion-routes";

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
  const [context, latestPrices, wikiMapping, quests, diaries, dropRates, items] = await Promise.all([
    loadPlanningContext(decoded, {
      viewerRsn,
      preferScapestack: source === "plugin-sync" || from === "plugin"
    }).catch(() => null),
    isOwner ? getLatestPrices().catch(() => new Map()) : Promise.resolve(new Map()),
    isOwner ? getWikiItemMapping().catch(() => new Map()) : Promise.resolve(new Map()),
    getQuests(),
    getDiaries(),
    getDropRates().catch(() => new Map()),
    getItems().catch(() => new Map())
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
  const exactDomain = (domain: "quests" | "diaries" | "collectionLog") => {
    const availability = exactSync?.availability?.[domain];
    return Boolean(exactSync && (availability === undefined || availability === "available"));
  };
  const exactBank = exactSync && shouldUsePluginBank({
    status: exactSync.bankStatus,
    itemCount: exactSync.bankItems.length,
    availability: exactSync.availability?.bank
  }) ? exactSync.bankItems : undefined;
  const syncHref = pluginVerifyUrlForSyncedRsn(displayName, "profile", {
    hasBankContext: bankItems.length > 0
  });
  const unavailableIdentityDomains = exactSync
    ? [
        !exactDomain("quests") ? "quests" : null,
        !exactDomain("diaries") ? "diaries" : null,
        !exactDomain("collectionLog") ? "collection log" : null,
        !exactBank ? "bank" : null
      ].filter((domain): domain is string => domain !== null)
    : [];
  const accountCoverage = !exactSync
    ? (
        <>
          Hiscores only — <Link href={syncHref}>connect RuneLite for quests, diaries and your bank</Link>
        </>
      )
    : unavailableIdentityDomains.length === 0
      ? "Hiscores + RuneLite — private progress included"
      : `Hiscores + RuneLite — unavailable this scan: ${unavailableIdentityDomains.join(", ")}`;
  const questProgress = exactDomain("quests")
    ? countCompletedQuests(quests, exactSync?.questsCompleted ?? [])
    : null;
  const diaryProgress = exactDomain("diaries")
    ? countCompletedDiaryTiers(diaries, exactSync?.diariesCompleted ?? []).completed
    : null;
  const diaryTotal = countCompletedDiaryTiers(diaries, []).total;
  const collectionLogProgress = exactDomain("collectionLog")
    ? new Set(exactSync?.collectionLogItemIds ?? []).size
    : null;
  const goalEvidence = buildPinnedGoalEvidence({
    skills: hi.skills,
    quests,
    questsCompleted: exactDomain("quests") ? exactSync?.questsCompleted : undefined,
    diariesCompleted: exactDomain("diaries") ? exactSync?.diariesCompleted : undefined,
    bankItems: exactBank
  });
  const suggestedGoals = pinnedGoalSuggestionsFromPlan(context.initialPlan);
  const maxRoute = buildMaxRoute(context.initialPlan?.maxEstimate.perSkill ?? []);
  const collectionRoute = buildCollectionLogRoute({
    dropRates,
    items,
    bosses: BOSSES,
    ownedItemIds: exactDomain("collectionLog")
      ? new Set(exactSync?.collectionLogItemIds ?? [])
      : context.collectionLog
        ? new Set(context.collectionLog.ownedItemIds)
        : null
  });
  const unlockRoutes = (context.initialPlan?.pathProgress.unlockRoutes ?? []).map((route) => ({
    id: route.id,
    title: route.title,
    payoff: route.payoff,
    iconItemId: route.iconItemId,
    pathNodes: route.pathNodes
  }));
  const cannotBuy = isIronPlannerAccount(accountMode);
  const simpleBank = bankItems.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity }));
  const goalBankFacts = exactBank
    ? buildPinnedGoalBankFacts(exactBank, latestPrices, wikiMapping, cannotBuy)
    : {};
  const goalBossSources = buildPinnedGoalBossSources(dropRates);
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
  const unknownIdentityReason = "This was not available in the latest RuneLite scan.";
  const header = (
    <header className="mb-5 border-b border-[var(--color-border)] pb-5">
      <h1 className="break-words text-[length:var(--text-page)] font-semibold leading-none text-[var(--color-text)]">
        {displayName}
      </h1>
      <p className="mt-2 text-[length:var(--text-micro)] text-[var(--color-text-muted)]">
        {accountType} · {formatSyncAge(syncedAt)}
      </p>
      <PlayerIdentityBand
        totalLevel={computeTotalLevel(hi.skills)}
        combatLevel={computeCombatLevel(hi.skills)}
        totalXp={totalXp(hi.skills)}
        questProgress={questProgress}
        questTotal={quests.size}
        diaryProgress={diaryProgress}
        diaryTotal={diaryTotal}
        collectionLogProgress={collectionLogProgress}
        collectionLogTotal={1600}
        coverage={accountCoverage}
        unknownReasons={exactSync ? {
          quests: unknownIdentityReason,
          diaries: unknownIdentityReason,
          "collection-log": unknownIdentityReason
        } : undefined}
      />
    </header>
  );

  const bank = (
    <section className="mt-10 border-t border-[var(--color-border)] pt-6" aria-labelledby="player-bank-title">
      <h2 id="player-bank-title" className="text-[length:var(--text-label)] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
        Your bank
      </h2>
      <BankObservationsPanel result={context.bankObservations} />
      {bankItems.length === 0 && (
        <p className="mt-2 max-w-[65ch] text-[length:var(--text-micro)] font-normal leading-relaxed text-[var(--color-text-muted)]">
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
      goalEvidence={goalEvidence}
      goalBankFacts={goalBankFacts}
      goalBossSources={goalBossSources}
    />
  );

  return (
    <PlayerHubShell
      header={header}
      lastTrip={<LastTripLine outcome={context.lastTripOutcome} />}
      goals={<PinnedGoalsPanel rsn={displayName} evidence={goalEvidence} canSync={isOwner} suggestions={suggestedGoals} />}
      plan={<PlayerPlanPanel
        rsn={displayName}
        initialContext={context}
        goalEvidence={goalEvidence}
        goalBossSources={goalBossSources}
      />}
      routes={<PlayerRoutesPanel
        rsn={displayName}
        maxRoute={maxRoute}
        collectionRoute={collectionRoute}
        unlockRoutes={unlockRoutes}
      />}
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

function normalizedCompletionName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function countCompletedQuests(
  quests: ReadonlyMap<string, { name: string }>,
  completed: readonly string[]
): number {
  const completedNames = new Set(completed.map(normalizedCompletionName));
  return [...quests.values()].filter((quest) => completedNames.has(normalizedCompletionName(quest.name))).length;
}

function countCompletedDiaryTiers(
  diaries: ReadonlyMap<string, { tiers: Record<DiaryTier, unknown> }>,
  completed: ReadonlyArray<{ region: string; tier: DiaryTier }>
): { completed: number; total: number } {
  const completedKeys = new Set(completed.map((entry) => (
    `${normalizedCompletionName(entry.region)}:${entry.tier.toLowerCase()}`
  )));
  let completedCount = 0;
  let total = 0;
  for (const [region, diary] of diaries) {
    for (const tier of Object.keys(diary.tiers) as DiaryTier[]) {
      total += 1;
      if (completedKeys.has(`${normalizedCompletionName(region)}:${tier.toLowerCase()}`)) completedCount += 1;
    }
  }
  return { completed: completedCount, total };
}
