// What of a player's RuneLite snapshot may leave the server.
//
// /next?rsn=<name> is a public URL. The page is a Server Component that hands
// its planning context to a Client Component, so every field in that object is
// serialised into the RSC payload embedded in the HTML — readable with one
// curl by anyone who can guess a name.
//
// That payload used to carry the whole SyncedPlayer: every bank item with id,
// name and quantity, the full collection-log id list, boss KC, the current
// Slayer task and exact per-skill XP. The plugin README promises Scapestack
// never sends inventory, chat or screenshots; it never said the bank becomes
// world-readable.
//
// The plan itself is computed on the server and stays bank-aware either way —
// the raw bank is only needed in the browser for the cross-tool handoff to
// /bank and /dps. So we send it only to the account's own paired browser and
// redact it for everyone else.
//
// Redacted is not empty: counts, status, coverage and sync freshness all
// survive, because the UI needs them to explain what the plan was based on.

import type { SyncedPlayer } from "./sync-repo";

/** The snapshot as a non-owner may see it: shape-compatible, contents removed. */
export type PublicSyncedPlayer = Omit<SyncedPlayer, "bankItems" | "collectionLogItemIds" | "skills" | "slayer"> & {
  bankItems: [];
  collectionLogItemIds: [];
  skills: Array<{ name: string; level: number }>;
  slayer: null;
  /** True when fields were withheld, so the UI can say so instead of implying emptiness. */
  redacted: true;
  /** Counts survive redaction — they drive "RuneLite bank: 812 items" style copy. */
  redactedCounts: {
    bankItems: number;
    collectionLogItemIds: number;
    hasSlayerTask: boolean;
  };
};

export type VisibleSyncedPlayer = SyncedPlayer | PublicSyncedPlayer;

export function isRedactedSyncedPlayer(
  player: VisibleSyncedPlayer | null | undefined
): player is PublicSyncedPlayer {
  return Boolean(player && (player as PublicSyncedPlayer).redacted === true);
}

/**
 * Strip everything a stranger has no business reading.
 *
 * Skill levels stay because they are already public on the Hiscores; exact XP
 * does not, because the Hiscores round it away for unranked skills and it is
 * not needed to render anything.
 */
export function redactSyncedPlayer(player: SyncedPlayer): PublicSyncedPlayer {
  return {
    ...player,
    bankItems: [],
    collectionLogItemIds: [],
    skills: player.skills.map((skill) => ({ name: skill.name, level: skill.level })),
    slayer: null,
    redacted: true,
    redactedCounts: {
      bankItems: player.bankItems.length,
      collectionLogItemIds: player.collectionLogItemIds.length,
      hasSlayerTask: Boolean(player.slayer)
    }
  };
}

/**
 * Owner sees everything, everyone else sees the redacted view.
 *
 * `viewerRsn` is the RSN of the paired browser session, already normalised.
 * Null means nobody is signed in, which is the common case: the plugin opens
 * /next in whatever browser is default, and that browser is usually unpaired.
 */
export function syncedPlayerForViewer(
  player: SyncedPlayer | null,
  viewerRsn: string | null
): VisibleSyncedPlayer | null {
  if (!player) return null;
  if (viewerRsn && viewerRsn === player.rsn) return player;
  return redactSyncedPlayer(player);
}
