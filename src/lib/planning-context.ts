import { runBoundedSource, type BoundedSourceTiming } from "@/lib/bounded-source";
import { fetchCollectionLog, type CollectionLog } from "@/lib/collection-log";
import { fetchHiscores, type PlayerHiscores } from "@/lib/hiscores";
import { computeNextUp, type NextUpResult } from "@/lib/next-up";
import { buildNextUpInputFromSources } from "@/lib/planning-input";
import { getSyncedPlayer, type SyncedPlayer } from "@/lib/sync-repo";
import { fetchTemple, type TempleData } from "@/lib/temple";
import { fetchWom, type WomPlayer } from "@/lib/wom";

export const PLANNING_SOURCE_DEADLINES_MS = {
  scapestack: 1_200,
  scapestackHandoffRetry: 1_200,
  hiscores: 900,
  wom: 300,
  temple: 300,
  collectionLog: 300
} as const;

export interface PlanningContextOptions {
  /** A successful plugin POST is authoritative. Give its immediate browser
   * handoff one retry so a cold Neon read cannot silently erase RuneLite. */
  preferScapestack?: boolean;
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

export interface TemplePayload {
  displayName: string;
  questsCompleted: string[];
  lastUpdatedAt: string | null;
}

export function templePayload(data: TempleData | null): TemplePayload | null {
  if (!data) return null;
  return {
    displayName: data.displayName,
    questsCompleted: Array.from(data.questsCompleted),
    lastUpdatedAt: data.lastUpdatedAt
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

export interface PlanningContextPayload {
  hiscores: PlayerHiscores | null;
  wom: WomPlayer | null;
  temple: TemplePayload | null;
  collectionLog: CollectionLogPayload | null;
  scapestackSync: SyncedPlayer | null;
  initialPlan: NextUpResult | null;
  timing: PlanningContextTiming;
}

async function computeInitialPlan(input: {
  rsn: string;
  hiscores: PlayerHiscores | null;
  wom: WomPlayer | null;
  temple: TempleData | null;
  collectionLog: CollectionLog | null;
  scapestackSync: SyncedPlayer | null;
}): Promise<NextUpResult | null> {
  const nextUpInput = buildNextUpInputFromSources({
    rsn: input.rsn,
    hiscores: input.hiscores,
    wom: input.wom,
    templeQuestsCompleted: input.temple ? Array.from(input.temple.questsCompleted) : undefined,
    collectionLogOwnedItemIds: input.collectionLog ? Array.from(input.collectionLog.ownedItemIds) : undefined,
    scapestackSync: input.scapestackSync
  });
  return nextUpInput ? computeNextUp(nextUpInput) : null;
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
  const [scapestack, hiscores, wom, temple, collectionLog] = await Promise.all([
    loadScapestackContext(rsn, options.preferScapestack === true),
    runBoundedSource("hiscores", PLANNING_SOURCE_DEADLINES_MS.hiscores, (signal) => fetchHiscores(rsn, { signal })),
    runBoundedSource("wom", PLANNING_SOURCE_DEADLINES_MS.wom, (signal) => fetchWom(rsn, { signal })),
    runBoundedSource("temple", PLANNING_SOURCE_DEADLINES_MS.temple, (signal) => fetchTemple(rsn, { signal })),
    runBoundedSource("collection_log", PLANNING_SOURCE_DEADLINES_MS.collectionLog, (signal) => fetchCollectionLog(rsn, { signal }))
  ]);

  const sources = [scapestack.timing, hiscores.timing, wom.timing, temple.timing, collectionLog.timing];
  const plannerStartedAt = performance.now();
  const initialPlan = await computeInitialPlan({
    rsn,
    hiscores: hiscores.value,
    wom: wom.value,
    temple: temple.value,
    collectionLog: collectionLog.value,
    scapestackSync: scapestack.value
  });
  const plannerMs = Math.max(0, Math.round(performance.now() - plannerStartedAt));
  const timing: PlanningContextTiming = {
    totalMs: Math.max(0, Math.round(performance.now() - startedAt)),
    criticalMs: Math.max(scapestack.timing.elapsedMs, hiscores.timing.elapsedMs),
    optionalMs: Math.max(wom.timing.elapsedMs, temple.timing.elapsedMs, collectionLog.timing.elapsedMs),
    plannerMs,
    timeoutCount: sources.filter((source) => source.state === "timeout").length,
    sources
  };

  // No RSN, bank rows or payload data: this is safe to retain in server logs.
  console.info("scapestack.next_context", JSON.stringify(timing));

  return {
    hiscores: hiscores.value,
    wom: wom.value,
    temple: templePayload(temple.value),
    collectionLog: collectionLogPayload(collectionLog.value),
    scapestackSync: scapestack.value,
    initialPlan,
    timing
  };
}
