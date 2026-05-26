"use server";

import { organize, exportTabs, type OrganizeResult, type OrganizedTab } from "@/lib/organizer";
import type { Archetype } from "@/lib/archetype";
import { computeNextUp, type NextUpInput, type NextUpResult } from "@/lib/next-up";
import { fetchHiscores, type PlayerHiscores } from "@/lib/hiscores";
import { fetchWom, type WomPlayer } from "@/lib/wom";
import { fetchCollectionLog, type CollectionLog } from "@/lib/collection-log";
import { fetchTemple, type TempleData } from "@/lib/temple";

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

export async function collectionLogAction(rsn: string): Promise<CollectionLogPayload | null> {
  // CollectionLog.net only has data for players who actively use their
  // RuneLite plugin. Most won't be tracked — null is the common path
  // and not an error. When we DO have data, the ownedItemIds set tells
  // the engine which iconic drops are actually owned (no more guessing
  // from bank pastes for raids the player skipped in their export).
  const log: CollectionLog | null = await fetchCollectionLog(rsn);
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

/** Serialisable shape for the same reason as the collection-log payload. */
export interface TemplePayload {
  displayName: string;
  questsCompleted: string[];
  lastUpdatedAt: string | null;
}

export async function templeAction(rsn: string): Promise<TemplePayload | null> {
  // TempleOSRS tracks per-quest completion for plugin-using accounts.
  // For Temple-tracked players we use real completion data instead of
  // the QP-budget heuristic in path-progress.
  const data: TempleData | null = await fetchTemple(rsn);
  if (!data) return null;
  return {
    displayName: data.displayName,
    questsCompleted: Array.from(data.questsCompleted),
    lastUpdatedAt: data.lastUpdatedAt
  };
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
