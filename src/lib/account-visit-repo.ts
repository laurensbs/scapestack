import { hasDatabase, sql } from "./db";
import { ensureSyncSchema } from "./sync-repo";

/**
 * The visit ledger and the §7 return metric.
 *
 * Two jobs, and they are the same job:
 *
 * 1. **Registration.** `account_identity` rows were only ever created by a
 *    plugin sync or a claim, so a player who types an RSN into the site has no
 *    row — and `accountsDueForRefresh` iterates that table. The daily cron
 *    therefore had nothing to read for exactly the population `hiscore_snapshot`
 *    was split away from `sync_snapshot` to serve. Registering on visit is what
 *    makes the backbone true for RSN-only players.
 *
 * 2. **D1/D7 return.** One row per account per day. `last_seen_at` is a single
 *    timestamp and can say "recently"; it cannot say "on day 7", which is the
 *    question §7 asks.
 *
 * Note the name: `account_retention` already exists and is about how long DATA
 * is kept. This is about whether a PLAYER came back.
 */

interface QueryClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T[]>;
}

function client(): QueryClient {
  return sql() as unknown as QueryClient;
}

export interface RegisteredVisit {
  accountId: string;
  /** True when this call created the identity, i.e. a first-ever visit. */
  registered: boolean;
}

/**
 * Records a visit for an account that already exists, or reports a miss.
 *
 * The hiscores check that guards registration only has to happen once per
 * account — it is there to stop an arbitrary string entering the cron's
 * roster, and a name already in the roster passed it when it got there.
 * Checking again on every page view would put a request to Jagex behind every
 * returning player, which is the opposite of what the roster is for.
 */
export async function recordVisitForKnownAccount(rsn: string): Promise<RegisteredVisit | null> {
  if (!hasDatabase()) return null;
  const normalised = rsn.trim().toLowerCase().slice(0, 12);
  if (!normalised) return null;
  await ensureSyncSchema();

  const rows = await client().query<{ account_id: string }>(
    `UPDATE account_identity SET last_seen_at = NOW()
     WHERE rsn = $1 AND deletion_requested_at IS NULL
     RETURNING account_id`,
    [normalised]
  );
  const accountId = rows[0]?.account_id;
  if (!accountId) return null;

  await client().query(
    `INSERT INTO account_visit (account_id, visit_date) VALUES ($1::uuid, CURRENT_DATE)
     ON CONFLICT DO NOTHING`,
    [accountId]
  );
  return { accountId, registered: false };
}

/**
 * Records that this RSN was looked at today, creating the identity if needed.
 *
 * `displayName` comes from the hiscores, and the caller must have confirmed
 * the account exists there before calling: an identity row is what puts an RSN
 * into the cron's roster, and a roster that accepts unverified names is a way
 * to make Scapestack fetch arbitrary strings from Jagex on demand.
 *
 * Idempotent per day by primary key. A player who reloads twenty times leaves
 * one row, so the return metric counts people rather than page views.
 */
export async function registerAccountVisit(input: {
  rsn: string;
  displayName: string;
}): Promise<RegisteredVisit | null> {
  if (!hasDatabase()) return null;
  const rsn = input.rsn.trim().toLowerCase().slice(0, 12);
  if (!rsn) return null;
  await ensureSyncSchema();

  const rows = await client().query<{ account_id: string; created: boolean }>(
    `WITH upsert AS (
       INSERT INTO account_identity (rsn, display_name, last_seen_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (rsn) DO UPDATE SET last_seen_at = NOW()
       RETURNING account_id, (xmax = 0) AS created
     )
     SELECT account_id, created FROM upsert`,
    [rsn, input.displayName.slice(0, 12) || rsn]
  );
  const row = rows[0];
  if (!row) return null;

  // A deleted account must not be resurrected by a page view. The upsert above
  // only touches last_seen_at, and the visit row is skipped while a deletion is
  // pending, so "delete my data" is not quietly undone by the player's own
  // browser reloading the page it was on.
  await client().query(
    `INSERT INTO account_visit (account_id, visit_date)
     SELECT account_id, CURRENT_DATE FROM account_identity
     WHERE account_id = $1::uuid AND deletion_requested_at IS NULL
     ON CONFLICT DO NOTHING`,
    [row.account_id]
  );

  return { accountId: row.account_id, registered: row.created === true };
}

export interface ReturnRates {
  /** Accounts old enough for the question to have an answer. */
  d1Cohort: number;
  d1Returned: number;
  d7Cohort: number;
  d7Returned: number;
}

/**
 * D1/D7 return, server-side (§7).
 *
 * The cohorts are deliberately different sizes. An account created yesterday
 * cannot yet have a day-7 answer, and counting it in the D7 denominator would
 * report a return rate lower than the truth — the direction a metric is least
 * likely to be questioned in, and therefore the one worth ruling out in SQL.
 * So each cohort only contains accounts whose window has fully closed.
 *
 * "Returned on day N" means a visit row dated exactly day-zero + N. Not "day N
 * or later": that is a cumulative-retention number, it only ever goes up with
 * time, and reading it as D7 flatters the product.
 */
export async function returnRates(): Promise<ReturnRates> {
  if (!hasDatabase()) return { d1Cohort: 0, d1Returned: 0, d7Cohort: 0, d7Returned: 0 };
  await ensureSyncSchema();
  const rows = await client().query<{
    d1_cohort: number; d1_returned: number; d7_cohort: number; d7_returned: number;
  }>(
    `WITH cohort AS (
       SELECT account_id, created_at::date AS day_zero
       FROM account_identity
       WHERE deletion_requested_at IS NULL
     )
     SELECT
       COUNT(*) FILTER (WHERE day_zero <= CURRENT_DATE - 2)::int AS d1_cohort,
       COUNT(*) FILTER (
         WHERE day_zero <= CURRENT_DATE - 2
           AND EXISTS (
             SELECT 1 FROM account_visit v
             WHERE v.account_id = cohort.account_id AND v.visit_date = day_zero + 1
           )
       )::int AS d1_returned,
       COUNT(*) FILTER (WHERE day_zero <= CURRENT_DATE - 8)::int AS d7_cohort,
       COUNT(*) FILTER (
         WHERE day_zero <= CURRENT_DATE - 8
           AND EXISTS (
             SELECT 1 FROM account_visit v
             WHERE v.account_id = cohort.account_id AND v.visit_date = day_zero + 7
           )
       )::int AS d7_returned
     FROM cohort`
  );
  const row = rows[0];
  return {
    d1Cohort: row?.d1_cohort ?? 0,
    d1Returned: row?.d1_returned ?? 0,
    d7Cohort: row?.d7_cohort ?? 0,
    d7Returned: row?.d7_returned ?? 0
  };
}

/**
 * A rate as a percentage, or null when the cohort is empty.
 *
 * Null rather than 0: a week with nobody in it is not a week where nobody came
 * back, and "0% D7 return" printed under an empty cohort has started more than
 * one wrong conversation.
 */
export function returnRate(returned: number, cohort: number): number | null {
  if (cohort <= 0) return null;
  return Math.round((returned / cohort) * 1000) / 10;
}
