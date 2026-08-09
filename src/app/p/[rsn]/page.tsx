import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountCoverageLine, type AccountCoverageState } from "@/components/account-coverage-line";
import { AccountRefreshLine } from "@/components/account-refresh-line";
import { FarmTimersLine } from "@/components/farm-timers-line";
import { HiscoresUnavailable } from "@/components/hiscores-unavailable";
import { LastTripLine } from "@/components/last-trip-line";
import { PlayerHubShell } from "@/components/player-hub-shell";
import { PinnedGoalsPanel } from "@/components/pinned-goals-panel";
import { PlayerPlanPanel } from "@/components/player-plan-panel";
import { PlayerRoutesPanel } from "@/components/player-routes-panel";
import { RegisterVisit } from "@/components/register-visit";
import {
  plannerAccountTypeLabel,
  scapestackAccountTypeToPlannerType
} from "@/lib/account-type";
import { BOSSES } from "@/lib/bosses";
import { fetchHiscores, formatXp, computeCombatLevel, computeTotalLevel, totalXp } from "@/lib/hiscores";
import { loadPlanningContext, PLANNING_SOURCE_DEADLINES_MS } from "@/lib/planning-context";
import { shouldUsePluginBank } from "@/lib/plugin-bank-status";
import { getDropRates } from "@/lib/drop-rates-db";
import { getItems } from "@/lib/item-db";
import { pluginVerifyUrlForSyncedRsn } from "@/lib/plugin-sync-actions";
import { buildPinnedGoalEvidence } from "@/lib/pinned-goal-evidence";
import { pinnedGoalSuggestionsFromPlan } from "@/lib/pinned-goal-suggestions";
import { buildPinnedGoalBossSources } from "@/lib/pinned-goal-orientation";
import { formatSyncAge } from "@/lib/player-identity";
import { getQuests } from "@/lib/quest-db";
import { getDiaries } from "@/lib/diary-db";
import { cleanRsnInput, normalizeRsn } from "@/lib/rsn";
import { resolveViewerRsn } from "@/lib/viewer-account";
import { isRedactedSyncedPlayer } from "@/lib/synced-player-visibility";
import { buildCollectionLogRoute, buildMaxRoute } from "@/lib/companion-routes";

/**
 * /p/[rsn] answers one question: what should I do when I log in tonight?
 *
 * Three sections — the answer, the goals, the routes — and a one-line header.
 * That budget is enforced by tests/e2e/page-budget.spec.ts, and the rule that
 * a section may only be added when one is removed lives in CLAUDE.md.
 * Everything else about the account (the full identity band, the skill table,
 * the bank, the four bank answers) is /u/[rsn], one click away.
 */

interface Props {
  params: Promise<{ rsn: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Props) {
  const { rsn } = await params;
  const decoded = cleanRsnInput(decodeURIComponent(rsn));
  // Same deadline as the page body's lookup. Unbounded, a black-holed
  // hiscores connection holds the whole response open on this fetch while
  // the body's bounded one has long since rendered the retry state.
  const hi = await fetchHiscores(decoded, {
    signal: AbortSignal.timeout(PLANNING_SOURCE_DEADLINES_MS.hiscores)
  });
  // Bare name: the layout template appends "· Scapestack". With the suffix
  // here the retry state's tab read "lauky · Scapestack · Scapestack".
  if (!hi) return { title: decoded };
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
  const [context, quests, diaries, dropRates, items] = await Promise.all([
    loadPlanningContext(decoded, {
      viewerRsn,
      preferScapestack: source === "plugin-sync" || from === "plugin"
    }).catch((error: unknown) => {
      // The hiscores cannot reject this promise — they are bounded and
      // classified inside the loader. A rejection here is Scapestack's own
      // failure, so it must reach the logs and must not be told as a Jagex
      // story (cause="internal" below).
      console.error("scapestack.planning_context_failed", error);
      return null;
    }),
    getQuests(),
    getDiaries(),
    getDropRates().catch(() => new Map()),
    getItems().catch(() => new Map())
  ]);
  // notFound() is reserved for Jagex answering 404 — the only proof the player
  // does not exist. A context that failed to load, or loaded without an answer
  // from the hiscores, is an unanswered question: render the retry state.
  // (Observed 2026-08-08: a transient hiscores failure right after a deploy
  // rendered /p/lauky as "this page does not exist" for a player who did.)
  if (!context || context.hiscoresState === "unavailable") {
    return <HiscoresUnavailable rsn={decoded} cause={context ? "hiscores" : "internal"} />;
  }
  const hi = context.hiscores;
  if (!hi) notFound();

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
  const goalEvidence = buildPinnedGoalEvidence({
    skills: hi.skills,
    quests,
    questsCompleted: exactDomain("quests") ? exactSync?.questsCompleted : undefined,
    diariesCompleted: exactDomain("diaries") ? exactSync?.diariesCompleted : undefined,
    bankItems: exactBank,
    // Boss KC comes from the hiscores, so it works without the plugin. The
    // collection log and combat achievements do not, and stay undefined rather
    // than 0 when unread — a goal cannot report progress from a number nobody
    // has looked at.
    activities: hi.activities,
    clogSlots: exactDomain("collectionLog") ? exactSync?.collectionLogItemIds?.length : undefined,
    caPoints: exactSync?.combatAchievements?.points
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
  const goalBossSources = buildPinnedGoalBossSources(dropRates);
  const profileHref = `/u/${encodeURIComponent(displayName)}`;

  // Three states, not two. "A row exists but this browser is not the paired
  // one" had no representation at all, which is why the page could say "synced
  // 9 days ago" and "Hiscores only" in the same breath.
  const coverage: AccountCoverageState = !context.scapestackSync
    ? { kind: "hiscores-only", syncHref }
    : !exactSync
      ? { kind: "synced-unpaired", syncedLabel: formatSyncAge(syncedAt) }
      : {
          kind: "paired",
          syncedLabel: formatSyncAge(syncedAt),
          missing: [
            !exactDomain("quests") ? "quests" : null,
            !exactDomain("diaries") ? "diaries" : null,
            !exactDomain("collectionLog") ? "collection log" : null,
            !exactBank ? "bank" : null
          ].filter((domain): domain is string => domain !== null)
        };
  // Owner-only by construction: redactSyncedPlayer strips `farming` for anyone
  // who is not the paired browser, so exactSync is the only source.
  const farmPatches = exactSync?.availability?.farming === "available"
    ? exactSync.farming ?? []
    : [];

  // Identity is the credential that makes the answer trustworthy, not the
  // answer — one line, not a screen. The six-cell band lives on /u/[rsn].
  const header = (
    <header className="mb-5 border-b border-[var(--color-border)] pb-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="break-words text-[length:var(--text-subject)] font-semibold leading-none text-[var(--color-text)]">
          {displayName}
        </h1>
        <p className="text-[length:var(--text-micro)] font-normal text-[var(--color-text-muted)]">
          {accountType} · {computeTotalLevel(hi.skills)} total · {computeCombatLevel(hi.skills)} cb · {formatSyncAge(syncedAt)}
        </p>
        <Link
          href={profileHref}
          className="text-[length:var(--text-micro)] font-normal text-[var(--color-text-muted)] underline underline-offset-2"
        >
          Full profile
        </Link>
        {/* The second reason to open this page. On the header line rather than
            in a section, because /p holds three and a fourth may only land in
            a commit that removes one. */}
        <AccountRefreshLine rsn={displayName} />
      </div>
      <div className="mt-1">
        <AccountCoverageLine rsn={displayName} state={coverage} />
      </div>
    </header>
  );

  return (
    <>
      {/* Renders nothing. Puts this player into the daily refresh roster and
          into the D1/D7 cohort — the cron iterates account_identity, which
          until now no RSN-only player was ever in. */}
      <RegisterVisit rsn={displayName} />
      <PlayerHubShell
      header={header}
      lastTrip={
        <>
          {farmPatches.length > 0 && <FarmTimersLine patches={farmPatches} rsn={displayName} />}
          <LastTripLine outcome={context.lastTripOutcome} />
        </>
      }
      plan={<PlayerPlanPanel
        rsn={displayName}
        initialContext={context}
        goalEvidence={goalEvidence}
        goalBossSources={goalBossSources}
        canSync={isOwner}
        goalSuggestions={suggestedGoals}
      />}
      goals={<PinnedGoalsPanel rsn={displayName} evidence={goalEvidence} canSync={isOwner} />}
      routes={<PlayerRoutesPanel
        rsn={displayName}
        maxRoute={maxRoute}
        collectionRoute={collectionRoute}
        unlockRoutes={unlockRoutes}
      />}
      />
    </>
  );
}
