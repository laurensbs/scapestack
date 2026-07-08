// Plugin-sync persistence layer.
//
// One row per (player-name) holding the latest sync from the
// scapestack RuneLite plugin. We don't keep history yet — overwrite on
// every sync — because the path-progress reads 'current state.' If we
// later want activity-graphs we add a sync_history table.

import { sql, hasDatabase } from "./db";
import { normalizeScapestackAccountType, type ScapestackAccountType } from "./account-type";
import { defaultPluginBankStatus, normalizePluginBankStatus, type PluginBankStatus } from "./plugin-bank-status";

export interface SyncedPlayer {
  rsn: string;             // canonical lowercased name
  displayName: string;     // as the plugin reported it
  accountType: ScapestackAccountType;
  skills: Array<{ name: string; level: number }>;
  questsCompleted: string[];
  diariesCompleted: Array<{ region: string; tier: "Easy" | "Medium" | "Hard" | "Elite" }>;
  collectionLogItemIds: number[];
  bankItems: Array<{ id: number; name: string; quantity: number }>;
  bankStatus: PluginBankStatus;
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
  account_type TEXT NOT NULL DEFAULT 'normal',
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  quests_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
  diaries_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
  collection_log_item_ids INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  bank_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  bank_status JSONB NOT NULL DEFAULT '{"enabled":false,"itemCount":0,"capturedAt":null,"unavailableReason":"opt-in-off"}'::jsonb,
  slayer JSONB,
  plugin_version TEXT NOT NULL DEFAULT 'unknown',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Existing player_sync tables get every post-v1 column added idempotently.
-- This keeps production safe when the RuneLite plugin starts sending new
-- fields before a fresh CREATE TABLE has run.
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS skills JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS quests_completed JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS diaries_completed JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS collection_log_item_ids INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS bank_items JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS bank_status JSONB NOT NULL DEFAULT '{"enabled":false,"itemCount":0,"capturedAt":null,"unavailableReason":"opt-in-off"}'::jsonb;
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS slayer JSONB;
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS plugin_version TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS player_sync_synced_at_idx ON player_sync(synced_at DESC);

-- First-claim-wins auth: each RSN binds to the first plugin token that
-- claimed it. Subsequent syncs must match the bound token.
CREATE TABLE IF NOT EXISTS player_claim (
  rsn TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE player_claim ADD COLUMN IF NOT EXISTS token_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE player_claim ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE player_claim ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
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
      SELECT rsn, display_name, skills, quests_completed, diaries_completed,
             account_type, collection_log_item_ids, bank_items, bank_status, slayer, plugin_version, synced_at
      FROM player_sync
      WHERE rsn = ${norm}
      LIMIT 1
    ` as Array<{
      rsn: string;
      display_name: string;
      account_type: string | null;
      skills: Array<{ name?: unknown; level?: unknown }> | null;
      quests_completed: string[];
      diaries_completed: Array<{ region: string; tier: SyncedPlayer["diariesCompleted"][number]["tier"] }>;
      collection_log_item_ids: number[];
      bank_items: Array<{ id?: unknown; name?: unknown; quantity?: unknown }> | null;
      bank_status: unknown;
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
    const bankItems = normalizeBankItems(row.bank_items);
    return {
      rsn: row.rsn,
      displayName: row.display_name,
      accountType: normalizeScapestackAccountType(row.account_type),
      skills: normalizeSkills(row.skills),
      questsCompleted: row.quests_completed,
      diariesCompleted: row.diaries_completed,
      collectionLogItemIds: row.collection_log_item_ids,
      bankItems,
      bankStatus: normalizePluginBankStatus(row.bank_status, bankItems.length),
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

export async function upsertSyncedPlayer(p: Omit<SyncedPlayer, "syncedAt">): Promise<string> {
  if (!hasDatabase()) {
    throw new Error("Database not configured");
  }
  const norm = normalize(p.rsn);
  if (!norm) throw new Error("Invalid RSN");
  const slayerJson = p.slayer ? JSON.stringify(p.slayer) : null;
  const bankItems = normalizeBankItems(p.bankItems);
  const bankStatus = normalizePluginBankStatus(p.bankStatus ?? defaultPluginBankStatus(bankItems.length), bankItems.length);
  const rows = await sql()`
    INSERT INTO player_sync (rsn, display_name, account_type, skills, quests_completed, diaries_completed,
                              collection_log_item_ids, bank_items, bank_status, slayer, plugin_version, synced_at)
    VALUES (${norm}, ${p.displayName}, ${normalizeScapestackAccountType(p.accountType)},
            ${JSON.stringify(normalizeSkills(p.skills))}::jsonb,
            ${JSON.stringify(p.questsCompleted)}::jsonb,
            ${JSON.stringify(p.diariesCompleted)}::jsonb,
            ${p.collectionLogItemIds},
            ${JSON.stringify(bankItems)}::jsonb,
            ${JSON.stringify(bankStatus)}::jsonb,
            ${slayerJson}::jsonb,
            ${p.pluginVersion},
            NOW())
    ON CONFLICT (rsn) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      account_type = EXCLUDED.account_type,
      skills = EXCLUDED.skills,
      quests_completed = EXCLUDED.quests_completed,
      diaries_completed = EXCLUDED.diaries_completed,
      collection_log_item_ids = EXCLUDED.collection_log_item_ids,
      bank_items = EXCLUDED.bank_items,
      bank_status = EXCLUDED.bank_status,
      slayer = EXCLUDED.slayer,
      plugin_version = EXCLUDED.plugin_version,
      synced_at = NOW()
    RETURNING synced_at
  ` as Array<{ synced_at: string | Date }>;
  const syncedAt = rows[0]?.synced_at;
  if (syncedAt instanceof Date) return syncedAt.toISOString();
  if (typeof syncedAt === "string") return new Date(syncedAt).toISOString();
  return new Date().toISOString();
}

function normalizeBankItems(items: unknown): SyncedPlayer["bankItems"] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is { id: unknown; name: unknown; quantity?: unknown } =>
      item !== null
      && typeof item === "object"
      && typeof (item as { id?: unknown }).id === "number"
      && Number.isFinite((item as { id: number }).id)
      && typeof (item as { name?: unknown }).name === "string")
    .map((item) => ({
      id: Math.floor(item.id as number),
      name: (item.name as string).slice(0, 100),
      quantity: typeof item.quantity === "number" && Number.isFinite(item.quantity)
        ? Math.max(1, Math.min(2_147_483_647, Math.floor(item.quantity)))
        : 1
    }))
    .filter((item) => item.id > 0 && item.id < 1_000_000 && item.name.trim().length > 0)
    .slice(0, 1200);
}

function normalizeSkills(skills: unknown): SyncedPlayer["skills"] {
  if (!Array.isArray(skills)) return [];
  return skills
    .filter((skill): skill is { name: unknown; level: unknown } =>
      skill !== null
      && typeof skill === "object"
      && typeof (skill as { name?: unknown }).name === "string"
      && typeof (skill as { level?: unknown }).level === "number"
      && Number.isFinite((skill as { level: number }).level))
    .map((skill) => ({
      name: (skill.name as string).trim().slice(0, 32),
      level: Math.max(1, Math.min(126, Math.floor(skill.level as number)))
    }))
    .filter((skill) => skill.name.length > 0)
    .slice(0, 32);
}
