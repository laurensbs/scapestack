import { runBoundedSource, type BoundedSourceTiming } from "@/lib/bounded-source";
import { getAccountSnapshotHistory } from "@/lib/account-history-repo";
import {
  buildSyncedBankObservations,
  type BankObservationResult
} from "@/lib/bank-observations";
import { fetchCollectionLog, type CollectionLog } from "@/lib/collection-log";
import { fetchHiscores, type PlayerHiscores } from "@/lib/hiscores";
import { computeNextUp, type NextUpResult } from "@/lib/next-up";
import { buildNextUpInputFromSources } from "@/lib/planning-input";
import { latestTripOutcome, type LastTripOutcome } from "@/lib/recommendation-outcome-repo";
import { normalizeRsn } from "@/lib/rsn";
import { getSyncedPlayer, type SyncedPlayer } from "@/lib/sync-repo";
import {
  slayerTaskProjection,
  syncedPlayerForViewer,
  type SlayerTaskProjection,
  type VisibleSyncedPlayer
} from "@/lib/synced-player-visibility";
import { fetchWom, type WomPlayer } from "@/lib/wom";

export const PLANNING_SOURCE_DEADLINES_MS = {
  scapestack: 1_200,
  scapestackHandoffRetry: 1_200,
  hiscores: 900,
  wom: 300,
  collectionLog: 300,
  bankObservations: 350
} as const;

export interface PlanningContextOptions {
  /** A successful plugin POST is authoritative. Give its immediate browser
   * handoff one retry so a cold Neon read cannot silently erase RuneLite. */
  preferScapestack?: boolean;
  /** Normalised RSN of the paired browser session. Only the account owner
   *  receives the unredacted snapshot; everyone else gets counts and status. */
  viewerRsn?: string | null;
}

export interface CollectionLogPayload {
  displayName: string;
  uniqueObtained: number;
  uniqueItems: number;
  ownedItemIds: number[];
  tabs: Record<string, { obtained: number; total: number }>;
  lastSyncedAt: string | null;
}

export function collectionLogPayload(log: CollectionLog | null): CollectionLogPayload | null {
  if (!log) return null;
  return {
    displayName: log.displayName,
    uniqueObtained: log.uniqueObtained,
    uniqueItems: log.uniqueItems,
    ownedItemIds: Array.from(log.ownedItemIds),
    tabs: log.tabs,
    lastSyncedAt: log.lastSyncedAt
  };
}



export interface PlanningContextTiming {
  totalMs: number;
  criticalMs: number;
  optionalMs: number;
  plannerMs: number;
  timeoutCount: number;
  sources: BoundedSourceTiming[];
}

const EMPTY_TIMING: PlanningContextTiming = {
  totalMs: 0,
  criticalMs: 0,
  optionalMs: 0,
  plannerMs: 0,
  timeoutCount: 0,
  sources: []
};

export interface PlanningContextPayload {
  hiscores: PlayerHiscores | null;
  wom: WomPlayer | null;
  collectionLog: CollectionLogPayload | null;
  /** Redacted for anyone who is not the account owner. See synced-player-visibility.ts. */
  scapestackSync: VisibleSyncedPlayer | null;
  /** Public, narrow projection already used by the former /slayer surface. */
  slayerTask: SlayerTaskProjection | null;
  initialPlan: NextUpResult | null;
  /**
   * The reconciled verdict on the trip the owner accepted last time, or null.
   * OWNER-ONLY, same rule as the unredacted snapshot: the write half derives
   * it from synced quests, KC and bank movement, so shipping it to a stranger
   * would leak through the summary what the redaction withholds in the raw.
   */
  lastTripOutcome: LastTripOutcome | null;
  /** Owner-only arithmetic derived from the synced bank series. */
  bankObservations: BankObservationResult | null;
  timing: PlanningContextTiming;
}

async function computeInitialPlan(input: {
  rsn: string;
  hiscores: PlayerHiscores | null;
  wom: WomPlayer | null;
  collectionLog: CollectionLog | null;
  scapestackSync: VisibleSyncedPlayer | null;
}): Promise<NextUpResult | null> {
  const nextUpInput = buildNextUpInputFromSources({
    rsn: input.rsn,
    hiscores: input.hiscores,
    wom: input.wom,
    collectionLogOwnedItemIds: input.collectionLog ? Array.from(input.collectionLog.ownedItemIds) : undefined,
    scapestackSync: input.scapestackSync
  });
  return nextUpInput ? computeNextUp(nextUpInput) : null;
}

/**
 * Everything after the network, as one pure function.
 *
 * Split out of `loadPlanningContext` so a guard can build the exact object that
 * reaches the browser and search it, rather than reading this file as text. The
 * previous guard did read it as text, matched `syncedPlayerForViewer(scapestack`
 * and passed while `initialPlan` — derived from the same bank — went out
 * unredacted next to it.
 */
export async function assemblePlanningPayload(input: {
  rsn: string;
  hiscores: PlayerHiscores | null;
  wom: WomPlayer | null;
  collectionLog: CollectionLog | null;
  scapestack: SyncedPlayer | null;
  viewerRsn: string | null;
  lastTripOutcome?: LastTripOutcome | null;
  bankObservations?: BankObservationResult | null;
  timing: PlanningContextTiming;
}): Promise<PlanningContextPayload> {
  // Redact FIRST, then plan.
  //
  // The old order was the whole bug. The plan was computed from the full
  // snapshot and only the raw bank was stripped afterwards, on the theory that
  // the plan "stays on the server" — but the plan is a prop on a Client
  // Component, so it is serialised into the HTML of a public URL like
  // everything else. A 97KB NextUpResult carries a per-goal ownership map with
  // exact matchedItemIds, and generated copy that quotes item names and stack
  // sizes. Redacting the source and keeping the derivative is not redaction.
  //
  // Planning from the visible snapshot means a stranger's view is not
  // bank-aware. That is the correct answer to "what should this account do
  // tonight" when you are not that account — not a degradation to work around.
  const visible = syncedPlayerForViewer(input.scapestack, input.viewerRsn);
  const initialPlan = await computeInitialPlan({
    rsn: input.rsn,
    hiscores: input.hiscores,
    wom: input.wom,
    collectionLog: input.collectionLog,
    scapestackSync: visible
  });
  // Same gate as the snapshot: the outcome summarises synced progress, so a
  // non-owner gets null even when a caller passed one in.
  const isOwner = Boolean(input.viewerRsn && input.viewerRsn === normalizeRsn(input.rsn));
  return {
    hiscores: input.hiscores,
    wom: input.wom,
    collectionLog: collectionLogPayload(input.collectionLog),
    scapestackSync: visible,
    slayerTask: slayerTaskProjection(input.scapestack),
    initialPlan,
    lastTripOutcome: isOwner ? input.lastTripOutcome ?? null : null,
    // An observation is bank data in sentence form. Keep it behind the exact
    // same gate as the raw snapshot and the plan derived from that snapshot.
    bankObservations: isOwner ? input.bankObservations ?? null : null,
    timing: input.timing
  };
}

/**
 * Loads the first recommendation once on the server. The route can stream this
 * work while the browser downloads its client chunks; the Server Action is a
 * fallback for client-only reruns, not the default first-answer path.
 */
async function loadScapestackContext(rsn: string, preferScapestack: boolean) {
  const first = await runBoundedSource(
    "scapestack",
    PLANNING_SOURCE_DEADLINES_MS.scapestack,
    () => getSyncedPlayer(rsn)
  );
  if (first.value || !preferScapestack) return first;

  const retry = await runBoundedSource(
    "scapestack_retry",
    PLANNING_SOURCE_DEADLINES_MS.scapestackHandoffRetry,
    () => getSyncedPlayer(rsn)
  );
  return {
    value: retry.value,
    timing: {
      source: "scapestack",
      elapsedMs: first.timing.elapsedMs + retry.timing.elapsedMs,
      state: retry.timing.state
    }
  };
}

export async function loadPlanningContext(
  rsn: string,
  options: PlanningContextOptions = {}
): Promise<PlanningContextPayload> {
  const startedAt = performance.now();
  const viewerIsOwner = Boolean(options.viewerRsn && options.viewerRsn === normalizeRsn(rsn));
  const [scapestack, hiscores, wom, collectionLog, lastTrip, snapshotHistory] = await Promise.all([
    loadScapestackContext(rsn, options.preferScapestack === true),
    runBoundedSource("hiscores", PLANNING_SOURCE_DEADLINES_MS.hiscores, (signal) => fetchHiscores(rsn, { signal })),
    runBoundedSource("wom", PLANNING_SOURCE_DEADLINES_MS.wom, (signal) => fetchWom(rsn, { signal })),
    runBoundedSource("collection_log", PLANNING_SOURCE_DEADLINES_MS.collectionLog, (signal) => fetchCollectionLog(rsn, { signal })),
    // Owner-only, and never on the critical path: a missing outcome line must
    // not cost the plan anything.
    viewerIsOwner ? latestTripOutcome(rsn).catch(() => null) : Promise.resolve(null),
    viewerIsOwner
      ? runBoundedSource(
          "bank_observations",
          PLANNING_SOURCE_DEADLINES_MS.bankObservations,
          () => getAccountSnapshotHistory(rsn, 50)
        )
      : Promise.resolve({
          value: null,
          timing: { source: "bank_observations", elapsedMs: 0, state: "miss" as const }
        })
  ]);

  const sources = [
    scapestack.timing,
    hiscores.timing,
    wom.timing,
    collectionLog.timing,
    ...(viewerIsOwner ? [snapshotHistory.timing] : [])
  ];
  const bankObservations = viewerIsOwner
    && scapestack.value?.bankStatus.enabled
    && scapestack.value.bankStatus.unavailableReason === null
    && snapshotHistory.value
    ? buildSyncedBankObservations({
        currentBank: scapestack.value.bankItems,
        snapshots: snapshotHistory.value.map((snapshot) => ({
          checksum: snapshot.checksum,
          capturedAt: snapshot.capturedAt,
          delta: snapshot.delta
        }))
      })
    : null;
  const plannerStartedAt = performance.now();
  const payload = await assemblePlanningPayload({
    rsn,
    hiscores: hiscores.value,
    wom: wom.value,
    collectionLog: collectionLog.value,
    scapestack: scapestack.value,
    viewerRsn: options.viewerRsn ?? null,
    lastTripOutcome: lastTrip,
    bankObservations,
    // Filled in below; the planner has to run before we can time it.
    timing: EMPTY_TIMING
  });
  const plannerMs = Math.max(0, Math.round(performance.now() - plannerStartedAt));
  const timing: PlanningContextTiming = {
    totalMs: Math.max(0, Math.round(performance.now() - startedAt)),
    criticalMs: Math.max(scapestack.timing.elapsedMs, hiscores.timing.elapsedMs),
    optionalMs: Math.max(wom.timing.elapsedMs, collectionLog.timing.elapsedMs, snapshotHistory.timing.elapsedMs),
    plannerMs,
    timeoutCount: sources.filter((source) => source.state === "timeout").length,
    sources
  };

  // No RSN, bank rows or payload data: this is safe to retain in server logs.
  console.info("scapestack.next_context", JSON.stringify(timing));

  return { ...payload, timing };
}
