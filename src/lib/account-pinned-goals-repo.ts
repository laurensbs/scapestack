import { sql } from "./db";
import { parsePinnedGoal, type PinnedGoal } from "./pinned-goals";
import { ensureSyncSchema } from "./sync-repo";

interface QueryClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T[]>;
}

function client(): QueryClient {
  return sql() as unknown as QueryClient;
}

export async function getAccountPinnedGoals(accountId: string): Promise<PinnedGoal[]> {
  await ensureSyncSchema();
  const rows = await client().query<{ goal: unknown }>(`
    SELECT goal
    FROM account_pinned_goal
    WHERE account_id = $1::uuid
    ORDER BY pinned_at ASC, goal_key ASC
  `, [accountId]);
  return rows.map((row) => parsePinnedGoal(row.goal)).filter((goal): goal is PinnedGoal => goal !== null);
}

export async function upsertAccountPinnedGoal(accountId: string, input: unknown): Promise<PinnedGoal | null> {
  const goal = parsePinnedGoal(input);
  if (!goal) return null;
  await ensureSyncSchema();
  await client().query(`
    INSERT INTO account_pinned_goal (account_id, goal_key, goal, pinned_at)
    VALUES ($1::uuid, $2, $3::jsonb, $4::timestamptz)
    ON CONFLICT (account_id, goal_key) DO NOTHING
  `, [accountId, goal.key, JSON.stringify(goal), goal.pinnedAt]);
  return goal;
}

export async function deleteAccountPinnedGoal(accountId: string, goalKey: string): Promise<boolean> {
  if (!/^(item|level|unlock):[a-z0-9:-]{1,90}$/.test(goalKey)) return false;
  await ensureSyncSchema();
  const rows = await client().query<{ goal_key: string }>(`
    DELETE FROM account_pinned_goal
    WHERE account_id = $1::uuid AND goal_key = $2
    RETURNING goal_key
  `, [accountId, goalKey]);
  return Boolean(rows[0]);
}
