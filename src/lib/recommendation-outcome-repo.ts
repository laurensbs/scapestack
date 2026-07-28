import type { AccountSnapshotDelta } from "./account-snapshot-delta";
import { sql } from "./db";
import { parseRecommendationDecision, type RecommendationDecision } from "./recommendation-decision";
import {
  reconcileRecommendationOutcome,
  type RecommendationOutcome
} from "./recommendation-outcome";
import type { SyncDeltaSummary } from "./sync-repo";

interface QueryClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T[]>;
}

interface ActiveDecisionRow extends Record<string, unknown> {
  decision_id: number | string;
  decision: unknown;
}

function client(): QueryClient {
  return sql() as unknown as QueryClient;
}

function normalizeRsn(rsn: string): string {
  return rsn.trim().toLowerCase().slice(0, 12);
}

export interface ReconciledRecommendationOutcome {
  outcomeId: number;
  decisionId: number;
  outcome: RecommendationOutcome;
}

async function activeStartedDecisions(rsn: string, capturedAt: string): Promise<Array<{
  decisionId: number;
  decision: RecommendationDecision;
}>> {
  const rows = await client().query<ActiveDecisionRow>(`
    WITH target AS (
      SELECT account_id FROM account_identity WHERE rsn = $1
    ), latest_lifecycle AS (
      SELECT DISTINCT ON (trip.decision_id)
             trip.decision_id, trip.event_type, trip.occurred_at, trip.event_id
      FROM trip_lifecycle_event trip
      WHERE trip.account_id = (SELECT account_id FROM target)
        AND trip.decision_id IS NOT NULL
        AND trip.occurred_at < $2::timestamptz
      ORDER BY trip.decision_id, trip.occurred_at DESC, trip.event_id DESC
    )
    SELECT decision.decision_id, decision.decision
    FROM recommendation_decision decision
    JOIN latest_lifecycle lifecycle ON lifecycle.decision_id = decision.decision_id
    WHERE decision.account_id = (SELECT account_id FROM target)
      AND lifecycle.event_type = 'started'
      AND NOT EXISTS (
        SELECT 1 FROM outcome_match outcome
        WHERE outcome.decision_id = decision.decision_id
          AND outcome.status IN ('completed', 'contradicted')
      )
    ORDER BY lifecycle.occurred_at, decision.decision_id
  `, [rsn, capturedAt]);

  return rows.flatMap((row) => {
    const decision = parseRecommendationDecision(row.decision);
    return decision ? [{ decisionId: Number(row.decision_id), decision }] : [];
  });
}

async function storeOutcome(input: {
  rsn: string;
  snapshotId: number;
  decisionId: number;
  outcome: RecommendationOutcome;
}): Promise<number | null> {
  const rows = await client().query<{ outcome_id: number | string }>(`
    INSERT INTO outcome_match (
      account_id, snapshot_id, decision_id, recommendation_id,
      evidence_type, status, outcome_key, evidence
    )
    SELECT account_id, $2, $3, $4, $5, $6, $7, $8::jsonb
    FROM account_identity WHERE rsn = $1
    ON CONFLICT (snapshot_id, decision_id) WHERE decision_id IS NOT NULL DO NOTHING
    RETURNING outcome_id
  `, [
    input.rsn,
    input.snapshotId,
    input.decisionId,
    input.outcome.recommendationId,
    input.outcome.evidenceType,
    input.outcome.status,
    input.outcome.id,
    JSON.stringify(input.outcome)
  ]);
  return rows[0] ? Number(rows[0].outcome_id) : null;
}

/** Reconciles each currently-started exact decision against one immutable snapshot. */
export async function reconcileActiveRecommendationOutcomes(input: {
  rsn: string;
  snapshotId: number;
  delta: AccountSnapshotDelta;
  syncSummary?: SyncDeltaSummary | null;
  capturedAt: string;
}): Promise<ReconciledRecommendationOutcome[]> {
  const rsn = normalizeRsn(input.rsn);
  if (!rsn) return [];
  const active = await activeStartedDecisions(rsn, input.capturedAt);
  const created: ReconciledRecommendationOutcome[] = [];
  for (const entry of active) {
    const outcome = reconcileRecommendationOutcome({
      decision: entry.decision,
      delta: input.delta,
      syncSummary: input.syncSummary
    });
    const outcomeId = await storeOutcome({
      rsn,
      snapshotId: input.snapshotId,
      decisionId: entry.decisionId,
      outcome
    });
    if (outcomeId !== null) created.push({ outcomeId, decisionId: entry.decisionId, outcome });
  }
  return created;
}

/** What /next shows the owner about their previous trip. Strings only. */
export interface LastTripOutcome {
  title: string;
  detail: string;
  nextStopPoint: string;
  status: RecommendationOutcome["status"];
  progress: { before: number; after: number; target: number; unit: string } | null;
  matchedAt: string;
}

/**
 * The newest reconciled outcome for an account, if it is worth a sentence.
 *
 * The write half of this loop has existed for a while: every plugin sync runs
 * reconcileActiveRecommendationOutcomes and stores a verdict about the stop
 * point the player accepted. The read half did not — the outcome landed on the
 * /u/[rsn] timeline and nowhere else, so the plan page greeted a returning
 * player as though nothing had happened. This is the read half.
 *
 * "unknown" outcomes are skipped: "Boss KC was not available in this scan" is
 * a diagnostic, not a greeting. Fourteen days is the cutoff — beyond that the
 * returning-player briefing owns the moment.
 */
export async function latestTripOutcome(rsn: string): Promise<LastTripOutcome | null> {
  const normalized = normalizeRsn(rsn);
  if (!normalized) return null;
  const rows = await client().query<{ evidence: unknown; matched_at: string }>(`
    SELECT om.evidence, om.matched_at
    FROM outcome_match om
    JOIN account_identity ai ON ai.account_id = om.account_id
    WHERE ai.rsn = $1
      AND om.status IS DISTINCT FROM 'unknown'
      AND om.matched_at > NOW() - INTERVAL '14 days'
    ORDER BY om.matched_at DESC, om.outcome_id DESC
    LIMIT 1
  `, [normalized]);
  const row = rows[0];
  if (!row) return null;
  const raw = typeof row.evidence === "string" ? JSON.parse(row.evidence) : row.evidence;
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<RecommendationOutcome>;
  if (typeof value.title !== "string" || typeof value.detail !== "string") return null;
  const progress = value.progress
    && typeof value.progress.before === "number"
    && typeof value.progress.after === "number"
    && typeof value.progress.target === "number"
      ? {
          before: value.progress.before,
          after: value.progress.after,
          target: value.progress.target,
          unit: String(value.progress.unit ?? "")
        }
      : null;
  return {
    title: value.title,
    detail: value.detail,
    nextStopPoint: typeof value.nextStopPoint === "string" ? value.nextStopPoint : "",
    status: (value.status ?? "unchanged") as RecommendationOutcome["status"],
    progress,
    matchedAt: String(row.matched_at)
  };
}
