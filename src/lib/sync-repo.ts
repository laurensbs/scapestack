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
  lastSyncSummary: SyncDeltaSummary | null;
  syncedAt: string;        // ISO timestamp
}

export interface SyncDeltaSummary {
  previousSyncedAt: string;
  questsCompleted: string[];
  diariesCompleted: Array<{ region: string; tier: SyncedPlayer["diariesCompleted"][number]["tier"] }>;
  collectionLogItemIds: number[];
  bank: {
    previousItemCount: number;
    currentItemCount: number;
    previousUnavailableReason: PluginBankStatus["unavailableReason"];
    currentUnavailableReason: PluginBankStatus["unavailableReason"];
    enabledChanged: boolean;
    itemCountChanged: boolean;
    statusChanged: boolean;
  } | null;
  accountType: {
    previous: ScapestackAccountType;
    current: ScapestackAccountType;
    changed: boolean;
  };
}

export interface SyncSnapshotForDiff {
  accountType: ScapestackAccountType;
  questsCompleted: string[];
  diariesCompleted: SyncedPlayer["diariesCompleted"];
  collectionLogItemIds: number[];
  bankItems: SyncedPlayer["bankItems"];
  bankStatus: PluginBankStatus;
  syncedAt: string | Date | null;
}

export interface UpsertSyncedPlayerResult {
  syncedAt: string;
  syncSummary: SyncDeltaSummary | null;
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
  sync_summary JSONB,
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
ALTER TABLE player_sync ADD COLUMN IF NOT EXISTS sync_summary JSONB;
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

let schemaReady: Promise<void> | null = null;

function schemaStatements(): string[] {
  return SCHEMA_SQL
    .split(/;\s*$/m)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function ensureSyncSchema(): Promise<void> {
  if (!hasDatabase()) return;
  schemaReady ??= (async () => {
    for (const statement of schemaStatements()) {
      await sql().query(statement);
    }
  })();
  return schemaReady;
}

function normalize(rsn: string): string {
  return rsn.trim().toLowerCase().slice(0, 12);
}

export async function getSyncedPlayer(rsn: string): Promise<SyncedPlayer | null> {
  if (!hasDatabase()) return null;
  const norm = normalize(rsn);
  if (!norm) return null;
  try {
    await ensureSyncSchema();
    const rows = await sql()`
      SELECT rsn, display_name, skills, quests_completed, diaries_completed,
             account_type, collection_log_item_ids, bank_items, bank_status, slayer, plugin_version, sync_summary, synced_at
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
      sync_summary: unknown;
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
      questsCompleted: normalizeQuestNames(row.quests_completed),
      diariesCompleted: normalizeDiariesCompleted(row.diaries_completed),
      collectionLogItemIds: normalizeCollectionLogItemIds(row.collection_log_item_ids),
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
      lastSyncSummary: normalizeSyncDeltaSummary(row.sync_summary),
      syncedAt: typeof row.synced_at === "string" ? row.synced_at : new Date(row.synced_at).toISOString()
    };
  } catch (err) {
    console.error("getSyncedPlayer failed:", err);
    return null;
  }
}

export async function upsertSyncedPlayer(p: Omit<SyncedPlayer, "syncedAt" | "lastSyncSummary">): Promise<UpsertSyncedPlayerResult> {
  if (!hasDatabase()) {
    throw new Error("Database not configured");
  }
  const norm = normalize(p.rsn);
  if (!norm) throw new Error("Invalid RSN");
  await ensureSyncSchema();
  const slayerJson = p.slayer ? JSON.stringify(p.slayer) : null;
  const bankItems = normalizeBankItems(p.bankItems);
  const bankStatus = normalizePluginBankStatus(p.bankStatus ?? defaultPluginBankStatus(bankItems.length), bankItems.length);
  const previousRows = await sql()`
    SELECT account_type, quests_completed, diaries_completed, collection_log_item_ids, bank_items, bank_status, synced_at
    FROM player_sync
    WHERE rsn = ${norm}
    LIMIT 1
  ` as Array<{
    account_type: string | null;
    quests_completed: unknown;
    diaries_completed: unknown;
    collection_log_item_ids: unknown;
    bank_items: unknown;
    bank_status: unknown;
    synced_at: string | Date | null;
  }>;
  const previousSnapshot = previousRows[0] ? snapshotFromRow(previousRows[0]) : null;
  const questsCompleted = normalizeQuestNames(p.questsCompleted);
  const diariesCompleted = normalizeDiariesCompleted(p.diariesCompleted);
  const collectionLogItemIds = normalizeCollectionLogItemIds(p.collectionLogItemIds);
  const accountType = normalizeScapestackAccountType(p.accountType);
  const syncSummary = buildSyncDeltaSummary(previousSnapshot, {
    accountType,
    questsCompleted,
    diariesCompleted,
    collectionLogItemIds,
    bankItems,
    bankStatus,
    syncedAt: null
  });
  const rows = await sql()`
    INSERT INTO player_sync (rsn, display_name, account_type, skills, quests_completed, diaries_completed,
                              collection_log_item_ids, bank_items, bank_status, slayer, plugin_version, sync_summary, synced_at)
    VALUES (${norm}, ${p.displayName}, ${accountType},
            ${JSON.stringify(normalizeSkills(p.skills))}::jsonb,
            ${JSON.stringify(questsCompleted)}::jsonb,
            ${JSON.stringify(diariesCompleted)}::jsonb,
            ${collectionLogItemIds},
            ${JSON.stringify(bankItems)}::jsonb,
            ${JSON.stringify(bankStatus)}::jsonb,
            ${slayerJson}::jsonb,
            ${p.pluginVersion},
            ${JSON.stringify(syncSummary)}::jsonb,
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
      sync_summary = EXCLUDED.sync_summary,
      synced_at = NOW()
    RETURNING synced_at
  ` as Array<{ synced_at: string | Date }>;
  const syncedAt = rows[0]?.synced_at;
  const syncedAtIso = syncedAt instanceof Date
    ? syncedAt.toISOString()
    : typeof syncedAt === "string"
      ? new Date(syncedAt).toISOString()
      : new Date().toISOString();
  return { syncedAt: syncedAtIso, syncSummary };
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

function normalizeQuestNames(quests: unknown): string[] {
  if (!Array.isArray(quests)) return [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const quest of quests) {
    if (typeof quest !== "string") continue;
    const name = quest.trim().slice(0, 100);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length >= 500) break;
  }
  return names;
}

function normalizeCollectionLogItemIds(ids: unknown): number[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<number>();
  const clean: number[] = [];
  for (const id of ids) {
    if (typeof id !== "number" || !Number.isFinite(id)) continue;
    const int = Math.floor(id);
    if (int <= 0 || int >= 1_000_000 || seen.has(int)) continue;
    seen.add(int);
    clean.push(int);
    if (clean.length >= 2000) break;
  }
  return clean;
}

function normalizeDiariesCompleted(diaries: unknown): SyncedPlayer["diariesCompleted"] {
  if (!Array.isArray(diaries)) return [];
  const allowed = new Set<SyncedPlayer["diariesCompleted"][number]["tier"]>(["Easy", "Medium", "Hard", "Elite"]);
  const seen = new Set<string>();
  const clean: SyncedPlayer["diariesCompleted"] = [];
  for (const diary of diaries) {
    if (!diary || typeof diary !== "object" || Array.isArray(diary)) continue;
    const row = diary as { region?: unknown; tier?: unknown };
    if (typeof row.region !== "string" || typeof row.tier !== "string") continue;
    const region = row.region.trim().slice(0, 64);
    const tier = row.tier as SyncedPlayer["diariesCompleted"][number]["tier"];
    const key = `${region.toLowerCase()}:${tier.toLowerCase()}`;
    if (!region || !allowed.has(tier) || seen.has(key)) continue;
    seen.add(key);
    clean.push({ region, tier });
    if (clean.length >= 64) break;
  }
  return clean;
}

function snapshotFromRow(row: {
  account_type: string | null;
  quests_completed: unknown;
  diaries_completed: unknown;
  collection_log_item_ids: unknown;
  bank_items: unknown;
  bank_status: unknown;
  synced_at: string | Date | null;
}): SyncSnapshotForDiff {
  const bankItems = normalizeBankItems(row.bank_items);
  return {
    accountType: normalizeScapestackAccountType(row.account_type),
    questsCompleted: normalizeQuestNames(row.quests_completed),
    diariesCompleted: normalizeDiariesCompleted(row.diaries_completed),
    collectionLogItemIds: normalizeCollectionLogItemIds(row.collection_log_item_ids),
    bankItems,
    bankStatus: normalizePluginBankStatus(row.bank_status, bankItems.length),
    syncedAt: row.synced_at
  };
}

function isoFromSyncDate(value: string | Date | null): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : value;
  }
  return new Date(0).toISOString();
}

function diaryDelta(
  previous: SyncedPlayer["diariesCompleted"],
  next: SyncedPlayer["diariesCompleted"]
): SyncedPlayer["diariesCompleted"] {
  const previousKeys = new Set(previous.map((d) => `${d.region.toLowerCase()}:${d.tier.toLowerCase()}`));
  return next.filter((d) => !previousKeys.has(`${d.region.toLowerCase()}:${d.tier.toLowerCase()}`));
}

export function buildSyncDeltaSummary(
  previous: SyncSnapshotForDiff | null,
  next: SyncSnapshotForDiff
): SyncDeltaSummary | null {
  if (!previous) return null;

  const previousQuests = new Set(previous.questsCompleted.map((q) => q.toLowerCase()));
  const questsCompleted = next.questsCompleted.filter((quest) => !previousQuests.has(quest.toLowerCase()));
  const previousCollectionLog = new Set(previous.collectionLogItemIds);
  const collectionLogItemIds = next.collectionLogItemIds
    .filter((id) => !previousCollectionLog.has(id))
    .slice(0, 24);
  const accountType = {
    previous: previous.accountType,
    current: next.accountType,
    changed: previous.accountType !== next.accountType
  };
  const bankChanged =
    previous.bankStatus.enabled !== next.bankStatus.enabled
    || previous.bankStatus.itemCount !== next.bankStatus.itemCount
    || previous.bankStatus.unavailableReason !== next.bankStatus.unavailableReason;
  const bank = bankChanged
    ? {
        previousItemCount: previous.bankStatus.itemCount,
        currentItemCount: next.bankStatus.itemCount,
        previousUnavailableReason: previous.bankStatus.unavailableReason,
        currentUnavailableReason: next.bankStatus.unavailableReason,
        enabledChanged: previous.bankStatus.enabled !== next.bankStatus.enabled,
        itemCountChanged: previous.bankStatus.itemCount !== next.bankStatus.itemCount,
        statusChanged: previous.bankStatus.unavailableReason !== next.bankStatus.unavailableReason
      }
    : null;
  const diariesCompleted = diaryDelta(previous.diariesCompleted, next.diariesCompleted);

  const summary: SyncDeltaSummary = {
    previousSyncedAt: isoFromSyncDate(previous.syncedAt),
    questsCompleted,
    diariesCompleted,
    collectionLogItemIds,
    bank,
    accountType
  };

  return hasSyncDelta(summary) ? summary : null;
}

export function hasSyncDelta(summary: SyncDeltaSummary | null | undefined): boolean {
  return Boolean(
    summary
    && (summary.questsCompleted.length > 0
      || summary.diariesCompleted.length > 0
      || summary.collectionLogItemIds.length > 0
      || summary.bank
      || summary.accountType.changed)
  );
}

function normalizeSyncDeltaSummary(summary: unknown): SyncDeltaSummary | null {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) return null;
  const row = summary as Partial<SyncDeltaSummary>;
  const accountPrevious = normalizeScapestackAccountType(row.accountType?.previous);
  const accountCurrent = normalizeScapestackAccountType(row.accountType?.current);
  const normalized: SyncDeltaSummary = {
    previousSyncedAt: typeof row.previousSyncedAt === "string" ? row.previousSyncedAt : new Date(0).toISOString(),
    questsCompleted: normalizeQuestNames(row.questsCompleted),
    diariesCompleted: normalizeDiariesCompleted(row.diariesCompleted),
    collectionLogItemIds: normalizeCollectionLogItemIds(row.collectionLogItemIds),
    bank: normalizeSyncDeltaBank(row.bank),
    accountType: {
      previous: accountPrevious,
      current: accountCurrent,
      changed: typeof row.accountType?.changed === "boolean"
        ? row.accountType.changed
        : accountPrevious !== accountCurrent
    }
  };
  return hasSyncDelta(normalized) ? normalized : null;
}

function normalizeSyncDeltaBank(bank: unknown): SyncDeltaSummary["bank"] {
  if (!bank || typeof bank !== "object" || Array.isArray(bank)) return null;
  const row = bank as {
    previousItemCount?: unknown;
    currentItemCount?: unknown;
    previousUnavailableReason?: unknown;
    currentUnavailableReason?: unknown;
    enabledChanged?: unknown;
    itemCountChanged?: unknown;
    statusChanged?: unknown;
  };
  const previousItemCount = typeof row.previousItemCount === "number" && Number.isFinite(row.previousItemCount)
    ? Math.max(0, Math.floor(row.previousItemCount))
    : 0;
  const currentItemCount = typeof row.currentItemCount === "number" && Number.isFinite(row.currentItemCount)
    ? Math.max(0, Math.floor(row.currentItemCount))
    : 0;
  const previousUnavailableReason = normalizePluginBankStatus({
    enabled: true,
    itemCount: previousItemCount,
    unavailableReason: row.previousUnavailableReason
  }, previousItemCount).unavailableReason;
  const currentUnavailableReason = normalizePluginBankStatus({
    enabled: true,
    itemCount: currentItemCount,
    unavailableReason: row.currentUnavailableReason
  }, currentItemCount).unavailableReason;
  return {
    previousItemCount,
    currentItemCount,
    previousUnavailableReason,
    currentUnavailableReason,
    enabledChanged: row.enabledChanged === true,
    itemCountChanged: row.itemCountChanged === true || previousItemCount !== currentItemCount,
    statusChanged: row.statusChanged === true || previousUnavailableReason !== currentUnavailableReason
  };
}
