import { sql } from "./db";
import { parsePinnedGoal, type PinnedGoal } from "./pinned-goals";
import { normalizeRsn } from "./rsn";
import { ensureSyncSchema } from "./sync-repo";

interface QueryClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T[]>;
}

function client(): QueryClient {
  return sql() as unknown as QueryClient;
}

/**
 * The shape a goal key may take.
 *
 * Kept in step with the database CHECK by a test, deliberately: item 1 widened
 * the constraint to the spec's types and left this regex on the original
 * three, so every new kind would have been accepted on write and then refused
 * on delete — a goal a player could pin and never remove.
 */
export const GOAL_KEY_PATTERN =
  /^(item|level|unlock|skill_level|skill_xp|boss_kc|gear_item|gear_tier|quest|diary|clog_slots|ca_tier|custom):[a-z0-9:_-]{1,90}$/;

/**
 * Rebuilds each row from its own columns.
 *
 * `baseline` and `is_primary` live in columns rather than only inside the goal
 * JSON because the database is what enforces one-primary-per-account, and a
 * constraint cannot see inside a jsonb blob.
 */
function rowToGoal(row: { goal: unknown; baseline: unknown; is_primary: unknown }): PinnedGoal | null {
  const stored = row.goal && typeof row.goal === "object" ? row.goal as Record<string, unknown> : null;
  if (!stored) return null;
  return parsePinnedGoal({
    ...stored,
    baseline: row.baseline ?? stored.baseline ?? null,
    isPrimary: row.is_primary === true
  });
}

const SELECT_COLUMNS = "goal, baseline, is_primary";

export async function getAccountPinnedGoals(accountId: string): Promise<PinnedGoal[]> {
  await ensureSyncSchema();
  const rows = await client().query<{ goal: unknown; baseline: unknown; is_primary: unknown }>(`
    SELECT ${SELECT_COLUMNS}
    FROM account_pinned_goal
    WHERE account_id = $1::uuid
    ORDER BY pinned_at ASC, goal_key ASC
  `, [accountId]);
  return rows.map(rowToGoal).filter((goal): goal is PinnedGoal => goal !== null);
}

/** Private goal lookup for the authenticated plugin sync response. */
export async function getAccountPinnedGoalsByRsn(rsn: string): Promise<PinnedGoal[]> {
  const normalized = normalizeRsn(rsn);
  if (!normalized) return [];
  await ensureSyncSchema();
  const rows = await client().query<{ goal: unknown; baseline: unknown; is_primary: unknown }>(`
    SELECT pinned.goal, pinned.baseline, pinned.is_primary
    FROM account_pinned_goal pinned
    JOIN account_identity identity ON identity.account_id = pinned.account_id
    WHERE identity.rsn = $1
    ORDER BY pinned.pinned_at ASC, pinned.goal_key ASC
  `, [normalized]);
  return rows.map(rowToGoal).filter((goal): goal is PinnedGoal => goal !== null);
}

export async function upsertAccountPinnedGoal(accountId: string, input: unknown): Promise<PinnedGoal | null> {
  const goal = parsePinnedGoal(input);
  if (!goal) return null;
  await ensureSyncSchema();
  // DO NOTHING on conflict, still: re-pinning an existing goal must not reset
  // its baseline. The baseline is the moment the player committed, and a
  // second click on the same row is not a new commitment — overwriting it
  // would silently reset the percentage to 0% every time.
  await client().query(`
    INSERT INTO account_pinned_goal (account_id, goal_key, goal, pinned_at, baseline)
    VALUES ($1::uuid, $2, $3::jsonb, $4::timestamptz, $5::jsonb)
    ON CONFLICT (account_id, goal_key) DO NOTHING
  `, [
    accountId,
    goal.key,
    JSON.stringify(goal),
    goal.pinnedAt,
    goal.baseline ? JSON.stringify(goal.baseline) : null
  ]);
  if (goal.isPrimary) await setAccountPrimaryGoal(accountId, goal.key);
  return goal;
}

/**
 * Moves the primary flag, as one statement.
 *
 * Clearing and setting in two round trips leaves a window with zero primaries,
 * and doing it in the other order trips the unique index outright. A single
 * UPDATE over the account's rows has neither problem.
 */
export async function setAccountPrimaryGoal(accountId: string, goalKey: string): Promise<boolean> {
  if (!GOAL_KEY_PATTERN.test(goalKey)) return false;
  await ensureSyncSchema();
  const rows = await client().query<{ goal_key: string }>(`
    UPDATE account_pinned_goal
    SET is_primary = (goal_key = $2)
    WHERE account_id = $1::uuid
      AND (goal_key = $2 OR is_primary)
    RETURNING goal_key
  `, [accountId, goalKey]);
  return rows.some((row) => row.goal_key === goalKey);
}

export async function deleteAccountPinnedGoal(accountId: string, goalKey: string): Promise<boolean> {
  if (!GOAL_KEY_PATTERN.test(goalKey)) return false;
  await ensureSyncSchema();
  const rows = await client().query<{ goal_key: string }>(`
    DELETE FROM account_pinned_goal
    WHERE account_id = $1::uuid AND goal_key = $2
    RETURNING goal_key
  `, [accountId, goalKey]);
  return Boolean(rows[0]);
}
