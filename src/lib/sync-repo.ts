// Plugin-sync persistence layer.
//
// One row per (player-name) holding the latest sync from the
// scapestack RuneLite plugin. We don't keep history yet — overwrite on
// every sync — because the path-progress reads 'current state.' If we
// later want activity-graphs we add a sync_history table.

import { sql, hasDatabase } from "./db";

export interface SyncedPlayer {
  rsn: string;             // canonical lowercased name
  displayName: string;     // as the plugin reported it
  questsCompleted: string[];
  diariesCompleted: Array<{ region: string; tier: "Easy" | "Medium" | "Hard" | "Elite" }>;
  collectionLogItemIds: number[];
  /** Slayer-state from the plugin's VarPlayer reads. Null when the
   *  plugin couldn't read it (no session / old plugin version).
   *  - currentTaskId: monster the player is currently assigned to (raw
   *    OSRS task-id; UI mapt via TASK_ID_TO_MONSTER)
   *  - blocks: vertaalde monster.id slugs uit de 6 block-slots */
  slayer: {
    points: number;
    streak: number;
    taskRemaining: number;
    currentTaskId: number;
    blocks: string[];
  } | null;
  pluginVersion: string;
  syncedAt: string;        // ISO timestamp
}

/** SQL to initialise the schema. Run once via `npm run db:init`. */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS player_sync (
  rsn TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  quests_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
  diaries_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
  collection_log_item_ids INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  slayer JSONB,
  plugin_version TEXT NOT NULL DEFAULT 'unknown',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Bestaande tables krijgen de slayer kolom ge-add'd (idempotent).
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS slayer JSONB;
CREATE INDEX IF NOT EXISTS player_sync_synced_at_idx ON player_sync(synced_at DESC);

-- First-claim-wins auth: each RSN binds to the first plugin token that
-- claimed it. Subsequent syncs must match the bound token.
CREATE TABLE IF NOT EXISTS player_claim (
  rsn TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

function normalize(rsn: string): string {
  return rsn.trim().toLowerCase().slice(0, 12);
}

export async function getSyncedPlayer(rsn: string): Promise<SyncedPlayer | null> {
  if (!hasDatabase()) return null;
  const norm = normalize(rsn);
  if (!norm) return null;
  try {
    const rows = await sql()`
      SELECT rsn, display_name, quests_completed, diaries_completed,
             collection_log_item_ids, slayer, plugin_version, synced_at
      FROM player_sync
      WHERE rsn = ${norm}
      LIMIT 1
    ` as Array<{
      rsn: string;
      display_name: string;
      quests_completed: string[];
      diaries_completed: Array<{ region: string; tier: SyncedPlayer["diariesCompleted"][number]["tier"] }>;
      collection_log_item_ids: number[];
      slayer: {
        points: number;
        streak: number;
        taskRemaining: number;
        currentTaskId?: number;
        blocks?: string[];
      } | null;
      plugin_version: string;
      synced_at: string;
    }>;
    const row = rows[0];
    if (!row) return null;
    return {
      rsn: row.rsn,
      displayName: row.display_name,
      questsCompleted: row.quests_completed,
      diariesCompleted: row.diaries_completed,
      collectionLogItemIds: row.collection_log_item_ids,
      // Pre-3.3 rijen in de DB hebben mogelijk geen currentTaskId/blocks
      // velden in hun JSONB blob — defaulten naar 0 / [] zodat de UI
      // consistent kan switchen zonder runtime crash.
      slayer: row.slayer
        ? {
            points: row.slayer.points,
            streak: row.slayer.streak,
            taskRemaining: row.slayer.taskRemaining,
            currentTaskId: row.slayer.currentTaskId ?? 0,
            blocks: row.slayer.blocks ?? []
          }
        : null,
      pluginVersion: row.plugin_version,
      syncedAt: typeof row.synced_at === "string" ? row.synced_at : new Date(row.synced_at).toISOString()
    };
  } catch (err) {
    console.error("getSyncedPlayer failed:", err);
    return null;
  }
}

export async function upsertSyncedPlayer(p: Omit<SyncedPlayer, "syncedAt">): Promise<void> {
  if (!hasDatabase()) {
    throw new Error("Database not configured");
  }
  const norm = normalize(p.rsn);
  if (!norm) throw new Error("Invalid RSN");
  const slayerJson = p.slayer ? JSON.stringify(p.slayer) : null;
  await sql()`
    INSERT INTO player_sync (rsn, display_name, quests_completed, diaries_completed,
                              collection_log_item_ids, slayer, plugin_version, synced_at)
    VALUES (${norm}, ${p.displayName},
            ${JSON.stringify(p.questsCompleted)}::jsonb,
            ${JSON.stringify(p.diariesCompleted)}::jsonb,
            ${p.collectionLogItemIds},
            ${slayerJson}::jsonb,
            ${p.pluginVersion},
            NOW())
    ON CONFLICT (rsn) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      quests_completed = EXCLUDED.quests_completed,
      diaries_completed = EXCLUDED.diaries_completed,
      collection_log_item_ids = EXCLUDED.collection_log_item_ids,
      slayer = EXCLUDED.slayer,
      plugin_version = EXCLUDED.plugin_version,
      synced_at = NOW()
  `;
}
