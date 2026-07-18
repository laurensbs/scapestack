import { sql } from "./db";
import {
  buildHistoricalBankSummary,
  buildSnapshotChecksum,
  buildSnapshotSummary,
  type ImmutableSnapshotState,
  type SnapshotSummary
} from "./account-history";
import {
  compareAccountSnapshots,
  resolveSnapshotAvailability,
  snapshotDeltaFreshness,
  type AccountSnapshotDelta,
  type ComparableAccountSnapshot
} from "./account-snapshot-delta";
import { recommendationDecisionCopy, type RecommendationDecision } from "./recommendation-decision";

interface QueryClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T[]>;
}

function client(): QueryClient {
  return sql() as unknown as QueryClient;
}

export interface PersistSyncInput {
  rsn: string;
  displayName: string;
  state: ImmutableSnapshotState;
  pluginVersion: string;
  syncSummary: unknown;
  previousSnapshot?: ComparableAccountSnapshot | null;
  capturedAt?: string;
}

export interface PersistSyncResult {
  syncedAt: string | Date;
  snapshotId: number | null;
  snapshotCreated: boolean;
  snapshotChecksum: string;
  accountDelta: AccountSnapshotDelta;
}

export const PERSIST_SYNC_SQL = `
WITH identity AS (
  INSERT INTO account_identity (rsn, display_name, last_seen_at)
  VALUES ($1, $2, $19::timestamptz)
  ON CONFLICT (rsn) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    last_seen_at = $19::timestamptz
  RETURNING account_id
), claim_link AS (
  UPDATE player_claim
  SET account_id = (SELECT account_id FROM identity)
  WHERE rsn = $1 AND account_id IS NULL
), inserted_snapshot AS (
  INSERT INTO sync_snapshot (
    account_id, checksum, summary, account_type, skills, quests_completed,
    diaries_completed, collection_log_item_ids, boss_kc, bank_summary,
    availability, coverage, delta, slayer, plugin_version, captured_at
  )
  SELECT account_id, $14, $15::jsonb, $3, $4::jsonb, $5::jsonb,
         $6::jsonb, $7::integer[], $8::jsonb, $16::jsonb, $17::jsonb,
         $20::jsonb, $18::jsonb, $11::jsonb, $12, $19::timestamptz
  FROM identity
  ON CONFLICT (account_id, checksum) DO NOTHING
  RETURNING snapshot_id
), latest AS (
  INSERT INTO player_sync (
    rsn, display_name, account_type, skills, quests_completed, diaries_completed,
    collection_log_item_ids, boss_kc, bank_items, bank_status, slayer, plugin_version,
    snapshot_coverage, sync_summary, synced_at
  )
  VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::integer[],
          $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12, $20::jsonb, $13::jsonb,
          $19::timestamptz)
  ON CONFLICT (rsn) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    account_type = EXCLUDED.account_type,
    skills = EXCLUDED.skills,
    quests_completed = EXCLUDED.quests_completed,
    diaries_completed = EXCLUDED.diaries_completed,
    collection_log_item_ids = EXCLUDED.collection_log_item_ids,
    boss_kc = EXCLUDED.boss_kc,
    bank_items = EXCLUDED.bank_items,
    bank_status = EXCLUDED.bank_status,
    slayer = EXCLUDED.slayer,
    plugin_version = EXCLUDED.plugin_version,
    snapshot_coverage = EXCLUDED.snapshot_coverage,
    sync_summary = EXCLUDED.sync_summary,
    synced_at = EXCLUDED.synced_at
  RETURNING synced_at
)
SELECT
  (SELECT synced_at FROM latest) AS synced_at,
  COALESCE(
    (SELECT snapshot_id FROM inserted_snapshot),
    (SELECT snapshot_id FROM sync_snapshot
     WHERE account_id = (SELECT account_id FROM identity) AND checksum = $14)
  ) AS snapshot_id,
  EXISTS(SELECT 1 FROM inserted_snapshot) AS snapshot_created
`;

export async function persistSyncAndSnapshot(input: PersistSyncInput): Promise<PersistSyncResult> {
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const checksum = buildSnapshotChecksum(input.state);
  const summary = buildSnapshotSummary(input.state);
  const bankSummary = buildHistoricalBankSummary(input.state);
  const availability = resolveSnapshotAvailability(input.state);
  const accountDelta = compareAccountSnapshots(input.previousSnapshot ?? null, {
    checksum,
    capturedAt,
    state: input.state
  }, { now: new Date(capturedAt).getTime() });
  const rows = await client().query<{
    synced_at: string | Date;
    snapshot_id: number | string | null;
    snapshot_created: boolean;
  }>(PERSIST_SYNC_SQL, [
    input.rsn,
    input.displayName,
    input.state.accountType,
    JSON.stringify(input.state.skills),
    JSON.stringify(input.state.questsCompleted),
    JSON.stringify(input.state.diariesCompleted),
    input.state.collectionLogItemIds,
    input.state.bossKc ? JSON.stringify(input.state.bossKc) : null,
    JSON.stringify(input.state.bankItems),
    JSON.stringify(input.state.bankStatus),
    input.state.slayer ? JSON.stringify(input.state.slayer) : null,
    input.pluginVersion,
    JSON.stringify(input.syncSummary),
    checksum,
    JSON.stringify(summary),
    JSON.stringify(bankSummary),
    JSON.stringify(availability),
    JSON.stringify(accountDelta),
    capturedAt,
    input.state.snapshotCoverage ? JSON.stringify(input.state.snapshotCoverage) : null
  ]);
  const row = rows[0];
  if (!row?.synced_at) throw new Error("Sync persistence returned no timestamp");
  return {
    syncedAt: row.synced_at,
    snapshotId: row.snapshot_id === null ? null : Number(row.snapshot_id),
    snapshotCreated: row.snapshot_created,
    snapshotChecksum: checksum,
    accountDelta
  };
}

export interface AccountSnapshotRecord {
  snapshotId: number;
  checksum: string;
  summary: SnapshotSummary;
  pluginVersion: string;
  capturedAt: string;
  delta: AccountSnapshotDelta | null;
}

function normalizeRsn(rsn: string): string {
  return rsn.trim().toLowerCase().slice(0, 12);
}

export async function getAccountSnapshotHistory(rsn: string, limit = 50): Promise<AccountSnapshotRecord[]> {
  const normalizedRsn = normalizeRsn(rsn);
  if (!normalizedRsn) return [];
  const rows = await client().query<{
    snapshot_id: number | string;
    checksum: string;
    summary: SnapshotSummary;
    plugin_version: string;
    captured_at: string;
    delta: AccountSnapshotDelta | null;
  }>(`
    SELECT snapshot.snapshot_id, snapshot.checksum, snapshot.summary,
           snapshot.plugin_version, snapshot.captured_at, snapshot.delta
    FROM sync_snapshot snapshot
    JOIN account_identity identity ON identity.account_id = snapshot.account_id
    WHERE identity.rsn = $1
    ORDER BY snapshot.captured_at DESC, snapshot.snapshot_id DESC
    LIMIT $2
  `, [normalizedRsn, Math.max(1, Math.min(250, Math.floor(limit)))]);
  return rows.map((row) => ({
    snapshotId: Number(row.snapshot_id),
    checksum: row.checksum,
    summary: row.summary,
    pluginVersion: row.plugin_version,
    capturedAt: new Date(row.captured_at).toISOString(),
    delta: row.delta && Object.keys(row.delta).length > 0
      ? { ...row.delta, freshness: snapshotDeltaFreshness(row.captured_at) }
      : null
  }));
}

export async function getLatestAccountDelta(rsn: string): Promise<AccountSnapshotDelta | null> {
  const normalizedRsn = normalizeRsn(rsn);
  if (!normalizedRsn) return null;
  const rows = await client().query<{ delta: AccountSnapshotDelta | null }>(`
    SELECT snapshot.delta
    FROM sync_snapshot snapshot
    JOIN account_identity identity ON identity.account_id = snapshot.account_id
    WHERE identity.rsn = $1
    ORDER BY snapshot.captured_at DESC, snapshot.snapshot_id DESC
    LIMIT 1
  `, [normalizedRsn]);
  const delta = rows[0]?.delta;
  return delta && Object.keys(delta).length > 0
    ? { ...delta, freshness: snapshotDeltaFreshness(delta.capturedAt) }
    : null;
}

export async function requestAccountDeletion(rsn: string, delayHours = 0): Promise<boolean> {
  const normalizedRsn = normalizeRsn(rsn);
  if (!normalizedRsn) return false;
  const rows = await client().query<{ requested: boolean }>(`
    WITH requested AS (
      UPDATE account_identity
      SET deletion_requested_at = NOW(),
          delete_after = NOW() + ($2 * INTERVAL '1 hour')
      WHERE rsn = $1
      RETURNING account_id, deletion_requested_at, delete_after
    ), retention AS (
      INSERT INTO account_retention (account_id, deletion_requested_at, delete_after, updated_at)
      SELECT account_id, deletion_requested_at, delete_after, NOW() FROM requested
      ON CONFLICT (account_id) DO UPDATE SET
        deletion_requested_at = EXCLUDED.deletion_requested_at,
        delete_after = EXCLUDED.delete_after,
        updated_at = NOW()
    )
    SELECT EXISTS(SELECT 1 FROM requested) AS requested
  `, [normalizedRsn, Math.max(0, Math.floor(delayHours))]);
  return rows[0]?.requested ?? false;
}

/** Explicit privacy deletion. Cascades through every immutable history table. */
export async function deleteAccountHistory(rsn: string): Promise<boolean> {
  const normalizedRsn = normalizeRsn(rsn);
  if (!normalizedRsn) return false;
  const rows = await client().query<{ deleted: boolean }>(`
    WITH target AS MATERIALIZED (
      SELECT account_id FROM account_identity WHERE rsn = $1
    ), deleted_latest AS (
      DELETE FROM player_sync WHERE rsn = $1 RETURNING rsn
    ), deleted_claim AS (
      DELETE FROM player_claim WHERE rsn = $1 RETURNING rsn
    ), deleted_identity AS (
      DELETE FROM account_identity
      WHERE account_id IN (SELECT account_id FROM target)
      RETURNING account_id
    )
    SELECT EXISTS(SELECT 1 FROM deleted_identity)
        OR EXISTS(SELECT 1 FROM deleted_latest)
        OR EXISTS(SELECT 1 FROM deleted_claim) AS deleted
  `, [normalizedRsn]);
  return rows[0]?.deleted ?? false;
}

export interface RecommendationDecisionInput {
  rsn: string;
  recommendationId: string;
  action: string;
  reason: string;
  routeFamily?: string;
  mood?: string;
  timeboxMinutes?: number;
  snapshotId?: number;
}

export async function recordRecommendationDecision(input: RecommendationDecisionInput): Promise<number | null> {
  const normalizedRsn = normalizeRsn(input.rsn);
  if (!normalizedRsn) return null;
  const rows = await client().query<{ decision_id: number | string }>(`
    INSERT INTO recommendation_decision (
      account_id, snapshot_id, recommendation_id, action, reason,
      route_family, mood, timebox_minutes
    )
    SELECT account_id, $2, $3, $4, $5, $6, $7, $8
    FROM account_identity WHERE rsn = $1
    RETURNING decision_id
  `, [normalizedRsn, input.snapshotId ?? null, input.recommendationId, input.action,
    input.reason, input.routeFamily ?? null, input.mood ?? null, input.timeboxMinutes ?? null]);
  return rows[0] ? Number(rows[0].decision_id) : null;
}

export interface RecordedRecommendationDecision {
  decisionId: number;
  created: boolean;
}

/** Stores the exact decision shown to a connected account. */
export async function recordRecommendationDecisionForAccount(
  accountId: string,
  decision: RecommendationDecision
): Promise<RecordedRecommendationDecision | null> {
  const copy = recommendationDecisionCopy(decision);
  const rows = await client().query<{
    decision_id: number | string;
    created: boolean;
  }>(`
    WITH recent AS (
      SELECT decision_id
      FROM recommendation_decision
      WHERE account_id = $1::uuid
        AND decision_key = $2
        AND decided_at > NOW() - INTERVAL '5 minutes'
      ORDER BY decided_at DESC, decision_id DESC
      LIMIT 1
    ), latest_snapshot AS (
      SELECT snapshot_id
      FROM sync_snapshot
      WHERE account_id = $1::uuid
      ORDER BY captured_at DESC, snapshot_id DESC
      LIMIT 1
    ), inserted AS (
      INSERT INTO recommendation_decision (
        account_id, snapshot_id, recommendation_id, decision_key,
        contract_version, decision, action, reason, route_family, mood,
        timebox_minutes
      )
      SELECT $1::uuid, (SELECT snapshot_id FROM latest_snapshot), $3, $2,
             $4, $5::jsonb, $6, $7, $8, $9, $10
      WHERE NOT EXISTS (SELECT 1 FROM recent)
      RETURNING decision_id
    )
    SELECT decision_id, TRUE AS created FROM inserted
    UNION ALL
    SELECT decision_id, FALSE AS created FROM recent
    LIMIT 1
  `, [
    accountId,
    decision.id,
    decision.recommendationId,
    decision.version,
    JSON.stringify(decision),
    copy.title,
    copy.why,
    decision.routeFamily,
    decision.constraints.mood,
    decision.timebox.minutes
  ]);
  return rows[0]
    ? { decisionId: Number(rows[0].decision_id), created: rows[0].created }
    : null;
}

export type TripLifecycleEventType = "planned" | "started" | "done" | "skipped" | "shared";

export interface RecordedTripLifecycleEvent {
  eventId: number;
  created: boolean;
}

/** Links a player action to the exact persisted decision shown in the UI. */
export async function recordRecommendationLifecycleForAccount(input: {
  accountId: string;
  decisionId: number;
  decision: RecommendationDecision;
  eventType: Extract<TripLifecycleEventType, "started" | "done" | "skipped">;
}): Promise<RecordedTripLifecycleEvent | null> {
  const rows = await client().query<{ event_id: number | string; created: boolean }>(`
    WITH latest AS (
      SELECT event_id, event_type, occurred_at
      FROM trip_lifecycle_event
      WHERE account_id = $1::uuid AND decision_id = $2
      ORDER BY occurred_at DESC, event_id DESC
      LIMIT 1
    ), inserted AS (
      INSERT INTO trip_lifecycle_event (
        account_id, decision_id, recommendation_id, event_type,
        route_family, mood, stop_point, title
      )
      SELECT $1::uuid, $2, $3, $4, $5, $6, $7, $8
      WHERE NOT EXISTS (
        SELECT 1 FROM latest
        WHERE event_type = $4 AND occurred_at > NOW() - INTERVAL '5 seconds'
      )
      RETURNING event_id
    )
    SELECT event_id, TRUE AS created FROM inserted
    UNION ALL
    SELECT event_id, FALSE AS created FROM latest
    WHERE event_type = $4 AND NOT EXISTS (SELECT 1 FROM inserted)
    LIMIT 1
  `, [
    input.accountId,
    input.decisionId,
    input.decision.recommendationId,
    input.eventType,
    input.decision.routeFamily,
    input.decision.constraints.mood,
    input.decision.stopPoint.label,
    input.decision.activity.title
  ]);
  return rows[0]
    ? { eventId: Number(rows[0].event_id), created: rows[0].created }
    : null;
}

export async function recordTripLifecycleEvent(input: {
  rsn: string;
  recommendationId: string;
  eventType: TripLifecycleEventType;
  snapshotId?: number;
  routeFamily?: string;
  mood?: string;
  stopPoint?: string;
  title?: string;
}): Promise<number | null> {
  const normalizedRsn = normalizeRsn(input.rsn);
  if (!normalizedRsn) return null;
  const rows = await client().query<{ event_id: number | string }>(`
    INSERT INTO trip_lifecycle_event (
      account_id, snapshot_id, recommendation_id, event_type,
      route_family, mood, stop_point, title
    )
    SELECT account_id, $2, $3, $4, $5, $6, $7, $8
    FROM account_identity WHERE rsn = $1
    RETURNING event_id
  `, [normalizedRsn, input.snapshotId ?? null, input.recommendationId, input.eventType,
    input.routeFamily ?? null, input.mood ?? null, input.stopPoint ?? null, input.title ?? null]);
  return rows[0] ? Number(rows[0].event_id) : null;
}

export async function recordAccountPreference(input: {
  rsn: string;
  mood?: string;
  timeboxMinutes?: number;
  routeFamily?: string;
  source?: string;
}): Promise<number | null> {
  const normalizedRsn = normalizeRsn(input.rsn);
  if (!normalizedRsn) return null;
  const rows = await client().query<{ preference_event_id: number | string }>(`
    INSERT INTO account_preference_event (account_id, mood, timebox_minutes, route_family, source)
    SELECT account_id, $2, $3, $4, $5
    FROM account_identity WHERE rsn = $1
    RETURNING preference_event_id
  `, [normalizedRsn, input.mood ?? null, input.timeboxMinutes ?? null,
    input.routeFamily ?? null, input.source ?? "player"]);
  return rows[0] ? Number(rows[0].preference_event_id) : null;
}

export async function recordOutcomeMatch(input: {
  rsn: string;
  snapshotId: number;
  recommendationId: string;
  evidenceType: string;
  evidence: Record<string, string | number | boolean | null>;
  decisionId?: number;
  status?: string;
  outcomeKey?: string;
}): Promise<number | null> {
  const normalizedRsn = normalizeRsn(input.rsn);
  if (!normalizedRsn) return null;
  const rows = await client().query<{ outcome_id: number | string }>(`
    INSERT INTO outcome_match (
      account_id, snapshot_id, decision_id, recommendation_id,
      evidence_type, status, outcome_key, evidence
    )
    SELECT account_id, $2, $6, $3, $4, $7, $8, $5::jsonb
    FROM account_identity WHERE rsn = $1
    ON CONFLICT DO NOTHING
    RETURNING outcome_id
  `, [normalizedRsn, input.snapshotId, input.recommendationId,
    input.evidenceType, JSON.stringify(input.evidence), input.decisionId ?? null,
    input.status ?? null, input.outcomeKey ?? null]);
  return rows[0] ? Number(rows[0].outcome_id) : null;
}
