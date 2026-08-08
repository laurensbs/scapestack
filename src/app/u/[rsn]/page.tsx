import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountCoverageLine, type AccountCoverageState } from "@/components/account-coverage-line";
import { AccountTimeline } from "@/components/account-timeline";
import { HiscoresUnavailable } from "@/components/hiscores-unavailable";
import { BankObservationsPanel } from "@/components/bank-observations-panel";
import { PlayerIdentityBand } from "@/components/player-identity-band";
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
import { fetchHiscores, computeCombatLevel, computeTotalLevel, totalXp } from "@/lib/hiscores";
import { buildMoneyMethodFilter } from "@/lib/money-methods";
import { loadPlanningContext } from "@/lib/planning-context";
import { pluginSyncHealth } from "@/lib/plugin-sync";
import { shouldUsePluginBank } from "@/lib/plugin-bank-status";
import { getDropRates } from "@/lib/drop-rates-db";
import { getLatestPrices, getWikiItemMapping } from "@/lib/wiki";
import { pluginVerifyUrlForSyncedRsn } from "@/lib/plugin-sync-actions";
import { buildPinnedGoalEvidence } from "@/lib/pinned-goal-evidence";
import {
  buildPinnedGoalBankFacts,
  buildPinnedGoalBossSources
} from "@/lib/pinned-goal-orientation";
import {
  countCompletedDiaryTiers,
  countCompletedQuests,
  formatSyncAge
} from "@/lib/player-identity";
import { getQuests } from "@/lib/quest-db";
import { getDiaries } from "@/lib/diary-db";
import { cleanRsnInput, normalizeRsn } from "@/lib/rsn";
import { decideSlayerTask } from "@/lib/slayer-task-decision";
import { MONSTERS_BY_ID } from "@/lib/slayer/monsters";
import { resolveSlayerTaskMonsterId } from "@/lib/slayer/task-ids";
import { resolveViewerRsn } from "@/lib/viewer-account";
import { isRedactedSyncedPlayer } from "@/lib/synced-player-visibility";
import { playerPath } from "@/lib/player-route";

/**
 * /u/[rsn] is the account, in full: the six-cell identity band, every skill,
 * the bank observations and the four bank answers. It holds what /p/[rsn]
 * deliberately does not — /p answers "what should I do tonight" inside a
 * three-section budget, and everything that is detail rather than answer
 * moved here on 2026-08-08. No height budget applies on this route; that is
 * the point of having it.
 *
 * (This file was a redirect to /p from 2026-07-30 to 2026-08-08, which left
 * the detail with nowhere to live except stacked under the answer.)
 */

interface Props {
  params: Promise<{ rsn: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { rsn } = await params;
  const decoded = cleanRsnInput(decodeURIComponent(rsn));
  return {
    // The layout template appends "· Scapestack" — adding it here doubles it.
    title: `${decoded} · account`,
    description: `${decoded}'s full account detail — identity, skills, bank and bank answers.`
  };
}

export default async function PlayerProfilePage({ params }: Props) {
  const [{ rsn }, viewerRsn] = await Promise.all([params, resolveViewerRsn()]);
  const decoded = cleanRsnInput(decodeURIComponent(rsn)).slice(0, 12);
  const isOwner = viewerRsn === normalizeRsn(decoded);
  const [context, latestPrices, wikiMapping, quests, diaries, dropRates] = await Promise.all([
    loadPlanningContext(decoded, { viewerRsn }).catch((error: unknown) => {
      // Same rule as /p: a rejection here is never the hiscores (those are
      // bounded and classified inside the loader) — log it and render the
      // internal-cause retry state, not a Jagex story.
      console.error("scapestack.planning_context_failed", error);
      return null;
    }),
    isOwner ? getLatestPrices().catch(() => new Map()) : Promise.resolve(new Map()),
    isOwner ? getWikiItemMapping().catch(() => new Map()) : Promise.resolve(new Map()),
    getQuests(),
    getDiaries(),
    getDropRates().catch(() => new Map())
  ]);
  // Same rule as /p: notFound() only on Jagex's own 404. A failed or
  // unanswered hiscores lookup renders the retry state instead of claiming
  // the page does not exist.
  if (!context || context.hiscoresState === "unavailable") {
    return <HiscoresUnavailable rsn={decoded} cause={context ? "hiscores" : "internal"} />;
  }
  const hi = context.hiscores;
  if (!hi) notFound();
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
  // Same three states as /p, from the same component — the contradiction was
  // that these two routes each told their own version of what is known.
  const coverage: AccountCoverageState = !context.scapestackSync
    ? { kind: "hiscores-only", syncHref }
    : !exactSync
      ? { kind: "synced-unpaired", syncedLabel: formatSyncAge(syncedAt) }
      : { kind: "paired", syncedLabel: formatSyncAge(syncedAt), missing: unavailableIdentityDomains };
  const accountCoverage = <AccountCoverageLine rsn={displayName} state={coverage} />;
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

  return (
    <main className="scape-page max-w-5xl">
      <header className="mb-5 border-b border-[var(--color-border)] pb-5">
        <h1 className="break-words text-[length:var(--text-page)] font-semibold leading-none text-[var(--color-text)]">
          {displayName}
        </h1>
        <p className="mt-2 text-[length:var(--text-micro)] font-normal text-[var(--color-text-muted)]">
          {accountType} · {formatSyncAge(syncedAt)} ·{" "}
          <Link href={playerPath(displayName)} className="underline underline-offset-2">
            Tonight&apos;s plan
          </Link>
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
      {/* The "since last time" recap. This component was orphaned during the
          07-30 restructure — exported, tested, rendered nowhere — and the e2e
          that would have caught it was not in the gate. It lives here now:
          account history is /u's job. */}
      <AccountTimeline expectedRsn={displayName} className="mt-8" />
      <section className="mt-10 border-t border-[var(--color-border)] pt-6" aria-labelledby="player-bank-title">
        <h2 id="player-bank-title" className="scape-section-name">
          Your bank
        </h2>
        <BankObservationsPanel result={context.bankObservations} />
        {bankItems.length === 0 && (
          <p className="mt-2 max-w-[65ch] text-[length:var(--text-micro)] font-normal leading-relaxed text-[var(--color-text-muted)]">
            Bank details stay private. Pair this browser and sync RuneLite to use your bank here.
          </p>
        )}
      </section>
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
      <PlayerSkillsTable displayName={displayName} skills={hi.skills} />
    </main>
  );
}
