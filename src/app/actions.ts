"use server";

import { organize, exportTabs, type OrganizeResult, type OrganizedTab } from "@/lib/organizer";
import type { Archetype } from "@/lib/archetype";
import { computeNextUp, type NextUpInput, type NextUpResult } from "@/lib/next-up";
import { fetchHiscores, type PlayerHiscores } from "@/lib/hiscores";
import { fetchWom, type WomPlayer } from "@/lib/wom";
import { fetchCollectionLog, type CollectionLog } from "@/lib/collection-log";
import { fetchTemple, type TempleData } from "@/lib/temple";
import { getSyncedPlayer, type SyncedPlayer } from "@/lib/sync-repo";
import { hasDatabase } from "@/lib/db";
import { runBoundedSource, type BoundedSourceTiming } from "@/lib/bounded-source";
import { buildNextUpInputFromSources } from "@/lib/planning-input";

const PLANNING_SOURCE_DEADLINES_MS = {
  scapestack: 900,
  hiscores: 1_200,
  wom: 450,
  temple: 450,
  collectionLog: 450
} as const;

export async function hiscoresAction(rsn: string): Promise<PlayerHiscores | null> {
  // Server-side proxy for the OSRS Hiscores fetch. The Jagex endpoint
  // doesn't ship CORS headers, so calling it from the browser fails
  // silently — looked like 'name not found' from the user's POV but was
  // actually a blocked network request. Going through this action puts
  // the fetch on Vercel/Node where CORS doesn't apply.
  return fetchHiscores(rsn);
}

export async function womAction(rsn: string): Promise<WomPlayer | null> {
  // Best-effort enrichment. WOM returns null for accounts that aren't
  // tracked there; the rest of /next falls back to Hiscores-only data.
  // Runs server-side so we control the User-Agent (WOM rate-limits
  // anonymous browser requests harder than identified server ones).
  return fetchWom(rsn);
}

/** Serialisable shape — Set isn't structured-clone-safe across the
 *  server/client boundary. Caller rebuilds the Set on the client side. */
export interface CollectionLogPayload {
  displayName: string;
  uniqueObtained: number;
  uniqueItems: number;
  ownedItemIds: number[];
  tabs: Record<string, { obtained: number; total: number }>;
  lastSyncedAt: string | null;
}

function collectionLogPayload(log: CollectionLog | null): CollectionLogPayload | null {
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

export async function collectionLogAction(rsn: string): Promise<CollectionLogPayload | null> {
  // CollectionLog.net only has data for players who actively use their
  // RuneLite plugin. Most won't be tracked — null is the common path
  // and not an error. When we DO have data, the ownedItemIds set tells
  // the engine which iconic drops are actually owned (no more guessing
  // from bank pastes for raids the player skipped in their export).
  return collectionLogPayload(await fetchCollectionLog(rsn));
}

/** Serialisable shape for the same reason as the collection-log payload. */
export interface TemplePayload {
  displayName: string;
  questsCompleted: string[];
  lastUpdatedAt: string | null;
}

function templePayload(data: TempleData | null): TemplePayload | null {
  if (!data) return null;
  return {
    displayName: data.displayName,
    questsCompleted: Array.from(data.questsCompleted),
    lastUpdatedAt: data.lastUpdatedAt
  };
}

export async function templeAction(rsn: string): Promise<TemplePayload | null> {
  // TempleOSRS tracks per-quest completion for plugin-using accounts.
  // For Temple-tracked players we use real completion data instead of
  // the QP-budget heuristic in path-progress.
  return templePayload(await fetchTemple(rsn));
}

/** Our own scapestack-plugin sync data. Highest-priority signal — beats
 *  Temple / WOM / cl.net because it's a direct feed from the player's
 *  game client. Null when the player hasn't installed the plugin (or
 *  when DATABASE_URL is unset in dev). */
export async function syncedPlayerAction(rsn: string): Promise<SyncedPlayer | null> {
  return getSyncedPlayer(rsn);
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
 * One bounded round trip for the first recommendation. Scapestack sync and
 * official Hiscores are the critical account read; community trackers are
 * optional and never get to delay the first useful plan beyond their budget.
 */
export async function planningContextAction(rsn: string): Promise<PlanningContextPayload> {
  const startedAt = performance.now();
  const [scapestack, hiscores, wom, temple, collectionLog] = await Promise.all([
    runBoundedSource("scapestack", PLANNING_SOURCE_DEADLINES_MS.scapestack, () => getSyncedPlayer(rsn)),
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

export type PluginSyncStatus =
  | { kind: "unconfigured" }
  | { kind: "missing"; rsn: string }
  | { kind: "found"; player: SyncedPlayer };

export async function pluginSyncStatusAction(rsn: string): Promise<PluginSyncStatus> {
  if (!hasDatabase()) return { kind: "unconfigured" };
  const trimmed = rsn.trim();
  const player = await getSyncedPlayer(trimmed);
  return player ? { kind: "found", player } : { kind: "missing", rsn: trimmed };
}

export async function nextUpAction(input: NextUpInput): Promise<NextUpResult> {
  // Server-side because the engine reads data/quests.json from disk via
  // node:fs. Keeping it behind a Server Action means the client bundle
  // never pulls in fs/promises and the quest dataset (~tens of KB) stays
  // on the server.
  return computeNextUp(input);
}

export async function organizeAction(
  input: string,
  options: { junkFilter?: boolean; includePrices?: boolean; archetype?: Archetype } = {}
): Promise<{ result?: OrganizeResult; strings?: string[]; error?: string }> {
  try {
    const result = await organize({
      input,
      junkFilter: options.junkFilter,
      includePrices: options.includePrices ?? true,
      archetype: options.archetype
    });
    const strings = exportTabs(result.tabs);
    return { result, strings };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to organize" };
  }
}

export async function exportAction(tabs: OrganizedTab[]): Promise<string[]> {
  return exportTabs(tabs);
}
