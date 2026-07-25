"use server";

import { organize, exportTabs, type OrganizeResult, type OrganizedTab } from "@/lib/organizer";
import type { Archetype } from "@/lib/archetype";
import { computeNextUp, type NextUpInput, type NextUpResult } from "@/lib/next-up";
import { fetchHiscores, type PlayerHiscores } from "@/lib/hiscores";
import { fetchWom, type WomPlayer } from "@/lib/wom";
import { fetchCollectionLog } from "@/lib/collection-log";
import { getSyncedPlayer } from "@/lib/sync-repo";
import { syncedPlayerForViewer, type VisibleSyncedPlayer } from "@/lib/synced-player-visibility";
import { resolveViewerRsn } from "@/lib/viewer-account";
import { hasDatabase } from "@/lib/db";
import { pluginSyncReceipt, type PluginSyncReceipt } from "@/lib/plugin-sync-receipt";
import {
  collectionLogPayload,
  loadPlanningContext,
  type CollectionLogPayload,
  type PlanningContextPayload,
} from "@/lib/planning-context";

export type {
  CollectionLogPayload,
  PlanningContextPayload,
  PlanningContextTiming,
} from "@/lib/planning-context";

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
export async function collectionLogAction(rsn: string): Promise<CollectionLogPayload | null> {
  // CollectionLog.net only has data for players who actively use their
  // RuneLite plugin. Most won't be tracked — null is the common path
  // and not an error. When we DO have data, the ownedItemIds set tells
  // the engine which iconic drops are actually owned (no more guessing
  // from bank pastes for raids the player skipped in their export).
  return collectionLogPayload(await fetchCollectionLog(rsn));
}


/** Our own scapestack-plugin sync data. Highest-priority signal — beats
 *  Temple / WOM / cl.net because it's a direct feed from the player's
 *  game client. Null when the player hasn't installed the plugin (or
 *  when DATABASE_URL is unset in dev). */
export async function syncedPlayerAction(rsn: string): Promise<VisibleSyncedPlayer | null> {
  // Server Actions are POST endpoints anyone can call with any RSN, so this
  // is subject to the same redaction as the SSR payload: bank items, the
  // collection log and the Slayer task only go to the account's own paired
  // browser. See lib/synced-player-visibility.ts.
  return syncedPlayerForViewer(await getSyncedPlayer(rsn), await resolveViewerRsn());
}

/**
 * One bounded round trip for the first recommendation. Scapestack sync and
 * official Hiscores are the critical account read; community trackers are
 * optional and never get to delay the first useful plan beyond their budget.
 */
export async function planningContextAction(rsn: string): Promise<PlanningContextPayload> {
  return loadPlanningContext(rsn, { viewerRsn: await resolveViewerRsn() });
}

export type PluginSyncStatus =
  | { kind: "unconfigured" }
  | { kind: "missing"; rsn: string }
  | { kind: "found"; player: PluginSyncReceipt };

export async function pluginSyncStatusAction(rsn: string): Promise<PluginSyncStatus> {
  if (!hasDatabase()) return { kind: "unconfigured" };
  const trimmed = rsn.trim();
  const player = await getSyncedPlayer(trimmed);
  return player ? { kind: "found", player: pluginSyncReceipt(player) } : { kind: "missing", rsn: trimmed };
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
