import { createHash } from "node:crypto";
import { sql } from "./db";
import { ensureSyncSchema } from "./sync-repo";
import {
  accountTimelineMoments,
  type AccountTimelinePage,
  type AccountTimelineRecord
} from "./account-timeline";

interface QueryClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T[]>;
}

function client(): QueryClient {
  return sql() as unknown as QueryClient;
}

interface TimelineCursor {
  at: string;
  key: string;
}

export interface LegacyTripEventInput {
  version: 1;
  id: string;
  kind: string;
  title: string;
  action: "planned" | "started" | "done" | "skipped" | "shared";
  savedAt: number;
  rsnKey?: string;
  mood?: string;
  routeLens?: string;
  stopPoint?: string;
}

function encodeCursor(cursor: TimelineCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeTimelineCursor(value: string | null | undefined): TimelineCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<TimelineCursor>;
    if (typeof parsed.at !== "string" || !Number.isFinite(Date.parse(parsed.at)) || typeof parsed.key !== "string" || !parsed.key) return null;
    return { at: new Date(parsed.at).toISOString(), key: parsed.key };
  } catch {
    return null;
  }
}

export function validTimelineCursor(value: string | null | undefined): boolean {
  return !value || decodeTimelineCursor(value) !== null;
}

export async function getAccountTimeline(
  accountId: string,
  options: { cursor?: string | null; limit?: number } = {}
): Promise<AccountTimelinePage> {
  await ensureSyncSchema();
  const cursor = decodeTimelineCursor(options.cursor);
  const limit = Math.max(1, Math.min(50, Math.floor(options.limit ?? 12)));
  const rows = await client().query<{
    source_kind: AccountTimelineRecord["sourceKind"];
    source_key: string;
    occurred_at: string;
    data: Record<string, unknown>;
  }>(`
    WITH decision_history AS (
      SELECT decision_id, action, reason, decided_at,
             LAG(action) OVER (PARTITION BY account_id ORDER BY decided_at, decision_id) AS previous_action
      FROM recommendation_decision
      WHERE account_id = $1::uuid
    ), timeline_rows AS (
      SELECT 'snapshot'::text AS source_kind,
             'snapshot:' || snapshot_id::text AS source_key,
             captured_at AS occurred_at,
             jsonb_build_object('delta', delta) AS data
      FROM sync_snapshot
      WHERE account_id = $1::uuid AND delta->>'kind' = 'changed'
        AND NOT EXISTS (
          SELECT 1 FROM outcome_match matched
          WHERE matched.snapshot_id = sync_snapshot.snapshot_id
            AND matched.status IN ('completed', 'progressed', 'contradicted')
        )
      UNION ALL
      SELECT 'trip'::text,
             'trip:' || trip.event_id::text,
             trip.occurred_at,
             jsonb_build_object(
               'eventType', trip.event_type,
               'recommendationId', trip.recommendation_id,
               'title', COALESCE(trip.title, decision.action),
               'stopPoint', trip.stop_point
             )
      FROM trip_lifecycle_event trip
      LEFT JOIN LATERAL (
        SELECT action FROM recommendation_decision
        WHERE account_id = trip.account_id AND recommendation_id = trip.recommendation_id
        ORDER BY decided_at DESC, decision_id DESC LIMIT 1
      ) decision ON TRUE
      WHERE trip.account_id = $1::uuid
      UNION ALL
      SELECT 'decision'::text,
             'decision:' || decision_id::text,
             decided_at,
             jsonb_build_object('action', action, 'reason', reason)
      FROM decision_history
      WHERE previous_action IS NOT NULL AND previous_action <> action
      UNION ALL
      SELECT 'outcome'::text,
             'outcome:' || outcome.outcome_id::text,
             outcome.matched_at,
             jsonb_build_object('outcome', outcome.evidence)
      FROM outcome_match outcome
      WHERE outcome.account_id = $1::uuid
        AND outcome.status IN ('completed', 'progressed', 'contradicted')
    )
    SELECT source_kind, source_key, occurred_at, data
    FROM timeline_rows
    WHERE ($2::timestamptz IS NULL OR occurred_at < $2::timestamptz
      OR (occurred_at = $2::timestamptz AND source_key < $3))
    ORDER BY occurred_at DESC, source_key DESC
    LIMIT $4
  `, [accountId, cursor?.at ?? null, cursor?.key ?? "", limit + 1]);

  const consumed = rows.slice(0, limit);
  const moments = accountTimelineMoments(consumed.map((row) => ({
    sourceKind: row.source_kind,
    sourceKey: row.source_key,
    occurredAt: new Date(row.occurred_at).toISOString(),
    data: row.data ?? {}
  })));
  const last = consumed.at(-1);
  return {
    moments,
    nextCursor: rows.length > limit && last
      ? encodeCursor({ at: new Date(last.occurred_at).toISOString(), key: last.source_key })
      : null
  };
}

function normalizedRsn(value: string | undefined): string {
  return value?.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 12) ?? "";
}

function legacyId(event: LegacyTripEventInput): string {
  return createHash("sha256").update(JSON.stringify([
    event.id, event.action, event.savedAt, event.title, event.stopPoint ?? ""
  ])).digest("hex");
}

export async function importLegacyTripEvents(
  accountId: string,
  accountRsn: string,
  input: unknown,
  now = Date.now()
): Promise<{ imported: number; ignored: number }> {
  const events = Array.isArray(input) ? input.slice(-80) : [];
  const rsn = normalizedRsn(accountRsn);
  const earliest = Date.UTC(2013, 1, 22);
  const clean: Array<Record<string, unknown>> = [];
  for (const value of events) {
    if (!value || typeof value !== "object") continue;
    const event = value as Partial<LegacyTripEventInput>;
    if (event.version !== 1 || typeof event.id !== "string" || typeof event.kind !== "string"
      || typeof event.title !== "string" || !["planned", "started", "done", "skipped", "shared"].includes(event.action ?? "")
      || typeof event.savedAt !== "number" || !Number.isFinite(event.savedAt)
      || event.savedAt < earliest || event.savedAt > now + 5 * 60 * 1000
      || normalizedRsn(event.rsnKey) !== rsn) continue;
    const typed = event as LegacyTripEventInput;
    clean.push({
      recommendation_id: typed.id.slice(0, 200),
      event_type: typed.action,
      route_family: (typed.routeLens || typed.kind).slice(0, 80),
      mood: typed.mood?.slice(0, 40) ?? null,
      stop_point: typed.stopPoint?.slice(0, 500) ?? null,
      title: typed.title.slice(0, 300),
      legacy_event_id: legacyId(typed),
      saved_at: new Date(typed.savedAt).toISOString()
    });
  }
  if (clean.length === 0) return { imported: 0, ignored: events.length };
  await ensureSyncSchema();
  const inserted = await client().query<{ event_id: string }>(`
    INSERT INTO trip_lifecycle_event (
      account_id, recommendation_id, event_type, route_family, mood,
      stop_point, title, legacy_event_id, occurred_at
    )
    SELECT $1::uuid, event.recommendation_id, event.event_type,
           event.route_family, event.mood, event.stop_point, event.title,
           event.legacy_event_id, event.saved_at::timestamptz
    FROM jsonb_to_recordset($2::jsonb) AS event(
      recommendation_id text, event_type text, route_family text, mood text,
      stop_point text, title text, legacy_event_id char(64), saved_at text
    )
    ON CONFLICT (account_id, legacy_event_id) WHERE legacy_event_id IS NOT NULL DO NOTHING
    RETURNING event_id
  `, [accountId, JSON.stringify(clean)]);
  return { imported: inserted.length, ignored: events.length - clean.length };
}
