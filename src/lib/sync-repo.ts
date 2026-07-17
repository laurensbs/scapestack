// Plugin-sync persistence layer.
//
// `player_sync` is the fast latest-state projection. Every distinct state is
// also appended to the privacy-minimized account history ledger.

import { sql, hasDatabase } from "./db";
import { normalizeScapestackAccountType, type ScapestackAccountType } from "./account-type";
import { defaultPluginBankStatus, normalizePluginBankStatus, type PluginBankStatus } from "./plugin-bank-status";
import { persistSyncAndSnapshot } from "./account-history-repo";
import { syncSchemaStatements } from "./sync-schema";
import type { SnapshotAvailability } from "./account-snapshot-delta";
import type { AccountSnapshotDelta } from "./account-snapshot-delta";
import itemsJson from "../../data/items.json";

export { SCHEMA_SQL } from "./sync-schema";

export interface SyncedPlayer {
  rsn: string;             // canonical lowercased name
  displayName: string;     // as the plugin reported it
  accountType: ScapestackAccountType;
  skills: Array<{ name: string; level: number; xp?: number }>;
  questsCompleted: string[];
  diariesCompleted: Array<{ region: string; tier: "Easy" | "Medium" | "Hard" | "Elite" }>;
  collectionLogItemIds: number[];
  bossKc?: Record<string, number> | null;
  bankItems: Array<{ id: number; name: string; quantity: number }>;
  bankStatus: PluginBankStatus;
  /** Slayer-state from RuneLite. Canonical task name and location are
   *  preferred; currentTaskId remains for older plugin snapshots. */
  slayer: {
    points: number;
    streak: number;
    taskRemaining: number;
    currentTaskId: number;
    taskName?: string | null;
    taskLocation?: string | null;
    blocks: string[];
  } | null;
  pluginVersion: string;
  availability?: Partial<SnapshotAvailability>;
  lastSyncSummary: SyncDeltaSummary | null;
  syncedAt: string;        // ISO timestamp
}

export interface SyncDeltaSummary {
  previousSyncedAt: string;
  questsCompleted: string[];
  diariesCompleted: Array<{ region: string; tier: SyncedPlayer["diariesCompleted"][number]["tier"] }>;
  collectionLogItemIds: number[];
  collectionLogItems: Array<{ id: number; name: string }>;
  skills: Array<{ name: string; previousLevel: number; currentLevel: number; xpGained: number }>;
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
  skills: SyncedPlayer["skills"];
  syncedAt: string | Date | null;
}

export interface UpsertSyncedPlayerResult {
  syncedAt: string;
  syncSummary: SyncDeltaSummary | null;
  snapshotId: number | null;
  snapshotCreated: boolean;
  accountDelta: AccountSnapshotDelta;
}

let schemaReady: Promise<void> | null = null;

export async function ensureSyncSchema(): Promise<void> {
  if (!hasDatabase()) return;
  schemaReady ??= (async () => {
    for (const statement of syncSchemaStatements()) {
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
             account_type, collection_log_item_ids, boss_kc, bank_items, bank_status, slayer, plugin_version, sync_summary, synced_at
      FROM player_sync
      WHERE rsn = ${norm}
      LIMIT 1
    ` as Array<{
      rsn: string;
      display_name: string;
      account_type: string | null;
      skills: Array<{ name?: unknown; level?: unknown; xp?: unknown }> | null;
      quests_completed: string[];
      diaries_completed: Array<{ region: string; tier: SyncedPlayer["diariesCompleted"][number]["tier"] }>;
      collection_log_item_ids: number[];
      boss_kc: unknown;
      bank_items: Array<{ id?: unknown; name?: unknown; quantity?: unknown }> | null;
      bank_status: unknown;
      slayer: {
        points: number;
        streak: number;
        taskRemaining: number;
        currentTaskId?: number;
        taskName?: string | null;
        taskLocation?: string | null;
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
      bossKc: normalizeBossKc(row.boss_kc),
      bankItems,
      bankStatus: normalizePluginBankStatus(row.bank_status, bankItems.length),
      // Pre-3.3 rijen in de DB hebben mogelijk geen currentTaskId/blocks
      // velden in hun JSONB blob — defaulten naar 0 / [] zodat de UI
      // consistent kan switchen zonder runtime crash.
      slayer: normalizeSlayer(row.slayer),
      pluginVersion: row.plugin_version,
      lastSyncSummary: normalizeSyncDeltaSummary(row.sync_summary),
      syncedAt: typeof row.synced_at === "string" ? row.synced_at : new Date(row.synced_at).toISOString()
    };
  } catch {
    console.error("getSyncedPlayer failed");
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
  const bankItems = normalizeBankItems(p.bankItems);
  const bankStatus = normalizePluginBankStatus(p.bankStatus ?? defaultPluginBankStatus(bankItems.length), bankItems.length);
  const previousRows = await sql()`
    SELECT current.account_type, current.skills, current.quests_completed,
           current.diaries_completed, current.collection_log_item_ids,
           current.boss_kc, current.bank_items, current.bank_status,
           current.slayer, current.synced_at,
           history.checksum AS snapshot_checksum,
           history.captured_at AS snapshot_captured_at,
           history.availability AS snapshot_availability
    FROM player_sync current
    LEFT JOIN account_identity identity ON identity.rsn = current.rsn
    LEFT JOIN LATERAL (
      SELECT checksum, captured_at, availability
      FROM sync_snapshot
      WHERE account_id = identity.account_id
      ORDER BY captured_at DESC, snapshot_id DESC
      LIMIT 1
    ) history ON TRUE
    WHERE current.rsn = ${norm}
    LIMIT 1
  ` as Array<{
    account_type: string | null;
    skills: unknown;
    quests_completed: unknown;
    diaries_completed: unknown;
    collection_log_item_ids: unknown;
    boss_kc: unknown;
    bank_items: unknown;
    bank_status: unknown;
    slayer: unknown;
    synced_at: string | Date | null;
    snapshot_checksum: string | null;
    snapshot_captured_at: string | Date | null;
    snapshot_availability: unknown;
  }>;
  const previousRow = previousRows[0];
  const previousSnapshot = previousRow ? snapshotFromRow(previousRow) : null;
  const questsCompleted = normalizeQuestNames(p.questsCompleted);
  const diariesCompleted = normalizeDiariesCompleted(p.diariesCompleted);
  const collectionLogItemIds = normalizeCollectionLogItemIds(p.collectionLogItemIds);
  const accountType = normalizeScapestackAccountType(p.accountType);
  const skills = normalizeSkills(p.skills);
  const bossKc = normalizeBossKc(p.bossKc);
  const nextSnapshot: SyncSnapshotForDiff = {
    accountType,
    skills,
    questsCompleted,
    diariesCompleted,
    collectionLogItemIds,
    bankItems,
    bankStatus,
    syncedAt: null
  };
  const syncSummary = buildSyncDeltaSummary(previousSnapshot, nextSnapshot);
  const previousComparable = previousRow?.snapshot_checksum && previousRow.snapshot_captured_at
    ? {
        checksum: previousRow.snapshot_checksum,
        capturedAt: isoFromSyncDate(previousRow.snapshot_captured_at),
        state: {
          accountType: normalizeScapestackAccountType(previousRow.account_type),
          skills: normalizeSkills(previousRow.skills),
          questsCompleted: normalizeQuestNames(previousRow.quests_completed),
          diariesCompleted: normalizeDiariesCompleted(previousRow.diaries_completed),
          collectionLogItemIds: normalizeCollectionLogItemIds(previousRow.collection_log_item_ids),
          bossKc: normalizeBossKc(previousRow.boss_kc),
          bankItems: normalizeBankItems(previousRow.bank_items),
          bankStatus: normalizePluginBankStatus(previousRow.bank_status, normalizeBankItems(previousRow.bank_items).length),
          slayer: normalizeSlayer(previousRow.slayer),
          availability: normalizeSnapshotAvailability(previousRow.snapshot_availability)
        }
      }
    : null;
  const persisted = await persistSyncAndSnapshot({
    rsn: norm,
    displayName: p.displayName,
    pluginVersion: p.pluginVersion,
    syncSummary,
    state: {
      accountType,
      skills,
      questsCompleted,
      diariesCompleted,
      collectionLogItemIds,
      bossKc,
      bankItems,
      bankStatus,
      slayer: normalizeSlayer(p.slayer),
      availability: p.availability
    },
    previousSnapshot: previousComparable
  });
  const syncedAt = persisted.syncedAt;
  const syncedAtIso = syncedAt instanceof Date
    ? syncedAt.toISOString()
    : typeof syncedAt === "string"
      ? new Date(syncedAt).toISOString()
      : new Date().toISOString();
  return {
    syncedAt: syncedAtIso,
    syncSummary,
    snapshotId: persisted.snapshotId,
    snapshotCreated: persisted.snapshotCreated,
    accountDelta: persisted.accountDelta
  };
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
    .filter((skill): skill is { name: unknown; level: unknown; xp?: unknown } =>
      skill !== null
      && typeof skill === "object"
      && typeof (skill as { name?: unknown }).name === "string"
      && typeof (skill as { level?: unknown }).level === "number"
      && Number.isFinite((skill as { level: number }).level))
    .map((skill) => ({
      name: (skill.name as string).trim().slice(0, 32),
      level: Math.max(1, Math.min(126, Math.floor(skill.level as number))),
      xp: typeof skill.xp === "number" && Number.isFinite(skill.xp)
        ? Math.max(0, Math.min(200_000_000, Math.floor(skill.xp)))
        : undefined
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

function normalizeBossKc(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries: Array<[string, number]> = [];
  for (const [rawName, rawKc] of Object.entries(value)) {
    const name = rawName.trim().slice(0, 80);
    if (!name || typeof rawKc !== "number" || !Number.isFinite(rawKc)) continue;
    entries.push([name, Math.max(0, Math.min(2_147_483_647, Math.floor(rawKc)))]);
    if (entries.length >= 128) break;
  }
  return entries.length > 0 ? Object.fromEntries(entries) : {};
}

function normalizeSlayer(value: unknown): SyncedPlayer["slayer"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Partial<NonNullable<SyncedPlayer["slayer"]>>;
  const integer = (entry: unknown, maximum: number) => typeof entry === "number" && Number.isFinite(entry)
    ? Math.max(0, Math.min(maximum, Math.floor(entry)))
    : 0;
  return {
    points: integer(row.points, 1_000_000),
    streak: integer(row.streak, 100_000),
    taskRemaining: integer(row.taskRemaining, 100_000),
    currentTaskId: integer(row.currentTaskId, 1_000_000),
    taskName: typeof row.taskName === "string" && row.taskName.trim() ? row.taskName.trim().slice(0, 80) : null,
    taskLocation: typeof row.taskLocation === "string" && row.taskLocation.trim() ? row.taskLocation.trim().slice(0, 100) : null,
    blocks: Array.isArray(row.blocks)
      ? row.blocks.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.slice(0, 80)).slice(0, 6)
      : []
  };
}

function normalizeSnapshotAvailability(value: unknown): Partial<SnapshotAvailability> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const allowed = new Set(["available", "unavailable", "unknown"]);
  const row = value as Record<string, unknown>;
  const keys: Array<keyof SnapshotAvailability> = ["skills", "quests", "diaries", "collectionLog", "bossKc", "slayer", "bank"];
  const result: Partial<SnapshotAvailability> = {};
  for (const key of keys) if (typeof row[key] === "string" && allowed.has(row[key])) {
    result[key] = row[key] as SnapshotAvailability[typeof key];
  }
  return Object.keys(result).length > 0 ? result : undefined;
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
  skills: unknown;
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
    skills: normalizeSkills(row.skills),
    questsCompleted: normalizeQuestNames(row.quests_completed),
    diariesCompleted: normalizeDiariesCompleted(row.diaries_completed),
    collectionLogItemIds: normalizeCollectionLogItemIds(row.collection_log_item_ids),
    bankItems,
    bankStatus: normalizePluginBankStatus(row.bank_status, bankItems.length),
    syncedAt: row.synced_at
  };
}

function skillDelta(
  previous: SyncedPlayer["skills"],
  next: SyncedPlayer["skills"]
): SyncDeltaSummary["skills"] {
  const previousByName = new Map(previous.map((skill) => [skill.name.toLowerCase(), skill]));
  return next
    .map((current) => {
      const before = previousByName.get(current.name.toLowerCase());
      if (!before) return null;
      const xpGained = typeof current.xp === "number" && typeof before.xp === "number"
        ? Math.max(0, current.xp - before.xp)
        : 0;
      const levelGained = current.level > before.level;
      if (!levelGained && xpGained <= 0) return null;
      return {
        name: current.name,
        previousLevel: before.level,
        currentLevel: current.level,
        xpGained
      };
    })
    .filter((skill): skill is SyncDeltaSummary["skills"][number] => Boolean(skill))
    .sort((a, b) => (b.xpGained - a.xpGained) || (b.currentLevel - b.previousLevel) - (a.currentLevel - a.previousLevel))
    .slice(0, 8);
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

function collectionLogItemName(id: number): string {
  const row = (itemsJson as Record<string, string | { name?: string }>)[String(Math.abs(id))];
  const name = typeof row === "string" ? row : row?.name;
  if (name && name.trim()) return id < 0 ? `${name.trim()} (variant)` : name.trim();
  return `#${id}`;
}

function collectionLogItemDelta(previousIds: number[], nextIds: number[]): Array<{ id: number; name: string }> {
  const previous = new Set(previousIds);
  return nextIds
    .filter((id) => !previous.has(id))
    .slice(0, 24)
    .map((id) => ({ id, name: collectionLogItemName(id) }));
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
  const collectionLogItems = collectionLogItemDelta(previous.collectionLogItemIds, next.collectionLogItemIds);
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
  const skills = skillDelta(previous.skills, next.skills);

  const summary: SyncDeltaSummary = {
    previousSyncedAt: isoFromSyncDate(previous.syncedAt),
    questsCompleted,
    diariesCompleted,
    collectionLogItemIds,
    collectionLogItems,
    skills,
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
      || summary.skills.length > 0
      || summary.collectionLogItemIds.length > 0
      || summary.collectionLogItems.length > 0
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
    collectionLogItems: normalizeSyncDeltaCollectionLogItems(row.collectionLogItems, row.collectionLogItemIds),
    skills: normalizeSyncDeltaSkills(row.skills),
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

function normalizeSyncDeltaCollectionLogItems(
  items: unknown,
  fallbackIds: unknown
): SyncDeltaSummary["collectionLogItems"] {
  if (Array.isArray(items)) {
    const clean: SyncDeltaSummary["collectionLogItems"] = [];
    const seen = new Set<number>();
    for (const item of items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const row = item as { id?: unknown; name?: unknown };
      const id = typeof row.id === "number" && Number.isFinite(row.id) ? Math.trunc(row.id) : null;
      if (!id || id <= 0 || seen.has(id)) continue;
      seen.add(id);
      const name = typeof row.name === "string" && row.name.trim() ? row.name.trim().slice(0, 96) : collectionLogItemName(id);
      clean.push({ id, name });
      if (clean.length >= 24) break;
    }
    if (clean.length > 0) return clean;
  }
  return normalizeCollectionLogItemIds(fallbackIds)
    .slice(0, 24)
    .map((id) => ({ id, name: collectionLogItemName(id) }));
}

function normalizeSyncDeltaSkills(skills: unknown): SyncDeltaSummary["skills"] {
  if (!Array.isArray(skills)) return [];
  const clean: SyncDeltaSummary["skills"] = [];
  const seen = new Set<string>();
  for (const skill of skills) {
    if (!skill || typeof skill !== "object" || Array.isArray(skill)) continue;
    const row = skill as { name?: unknown; previousLevel?: unknown; currentLevel?: unknown; xpGained?: unknown };
    if (typeof row.name !== "string" || typeof row.previousLevel !== "number" || typeof row.currentLevel !== "number") continue;
    const name = row.name.trim().slice(0, 32);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    clean.push({
      name,
      previousLevel: Math.max(1, Math.min(126, Math.floor(row.previousLevel))),
      currentLevel: Math.max(1, Math.min(126, Math.floor(row.currentLevel))),
      xpGained: typeof row.xpGained === "number" && Number.isFinite(row.xpGained)
        ? Math.max(0, Math.min(200_000_000, Math.floor(row.xpGained)))
        : 0
    });
    if (clean.length >= 8) break;
  }
  return clean;
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
