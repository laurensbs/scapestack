import { sql } from "./db";
import type { MilestoneCandidate } from "./milestone-thresholds";
import { ensureSyncSchema } from "./sync-repo";

/**
 * The append-only milestone ledger (SPEC §2.2).
 *
 * `kind` is constrained by the database to seven real in-game achievements —
 * PRINCIPLE 1 is enforced there, not here, so a future caller cannot invent a
 * badge for opening the site even by accident.
 */

interface QueryClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T[]>;
}

function client(): QueryClient {
  return sql() as unknown as QueryClient;
}

/**
 * Insert milestones, skipping ones this account already has.
 *
 * Crossing 99 Slayer happens once. Without the dedupe, a cron that re-read the
 * same day — or a backfill — would announce it again, and a milestone that can
 * repeat is not a milestone.
 */
export async function recordMilestones(accountId: string, candidates: readonly MilestoneCandidate[]): Promise<number> {
  if (candidates.length === 0) return 0;
  await ensureSyncSchema();
  let inserted = 0;
  for (const candidate of candidates) {
    const rows = await client().query<{ milestone_id: string }>(`
      INSERT INTO milestone (account_id, kind, payload)
      SELECT $1::uuid, $2, $3::jsonb
      WHERE NOT EXISTS (
        SELECT 1 FROM milestone
        WHERE account_id = $1::uuid AND kind = $2 AND payload = $3::jsonb
      )
      RETURNING milestone_id
    `, [accountId, candidate.kind, JSON.stringify(candidate.payload)]);
    if (rows.length > 0) inserted += 1;
  }
  return inserted;
}

export interface MilestoneRow {
  kind: string;
  payload: Record<string, unknown>;
  achievedAt: string;
}

export async function recentMilestones(accountId: string, limit = 10): Promise<MilestoneRow[]> {
  await ensureSyncSchema();
  const rows = await client().query<{ kind: string; payload: unknown; achieved_at: string }>(`
    SELECT kind, payload, achieved_at
    FROM milestone
    WHERE account_id = $1::uuid
    ORDER BY achieved_at DESC
    LIMIT $2
  `, [accountId, limit]);
  return rows.map((row) => ({
    kind: row.kind,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    achievedAt: new Date(row.achieved_at).toISOString()
  }));
}
