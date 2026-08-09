import { hasDatabase, sql } from "./db";
import { returnRates, returnRate, type ReturnRates } from "./account-visit-repo";
import { ensureSyncSchema } from "./sync-repo";
import { recapMetrics, weekStart } from "./weekly-recap-repo";

/**
 * The numbers §7 gates the next phase on, read from the database.
 *
 * All four are facts the server already records — a pinned goal is a row, a
 * recap send is a row, a click is a timestamp, a return is a visit date. None
 * of them is a client-side event, because §7's thresholds decide what gets
 * built and a metric an ad blocker can move is not a threshold.
 */

interface QueryClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T[]>;
}

function client(): QueryClient {
  return sql() as unknown as QueryClient;
}

export interface GoalSetRate {
  accounts: number;
  withGoal: number;
  /** 0–100, or null when there is nobody to measure. */
  percent: number | null;
}

/**
 * §7: >40% of new players set a goal in their first session.
 *
 * Measured over accounts that have had a first session at all. Accounts
 * created and never returned to still count — dropping them would measure the
 * goal rate among people who already liked the product.
 */
export async function goalSetRate(): Promise<GoalSetRate> {
  if (!hasDatabase()) return { accounts: 0, withGoal: 0, percent: null };
  await ensureSyncSchema();
  const rows = await client().query<{ accounts: string; with_goal: string }>(`
    SELECT COUNT(*) AS accounts,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM account_pinned_goal g WHERE g.account_id = i.account_id
           )) AS with_goal
    FROM account_identity i
    WHERE i.deletion_requested_at IS NULL
  `);
  const accounts = Number(rows[0]?.accounts ?? 0);
  const withGoal = Number(rows[0]?.with_goal ?? 0);
  return { accounts, withGoal, percent: accounts > 0 ? Math.round((withGoal / accounts) * 1000) / 10 : null };
}

export interface SpecMetrics {
  /** §7 goal-set rate. Gate: >40%. */
  goals: GoalSetRate;
  /** §7 recap delivery and CTR. Gate: >25% CTR. */
  recap: {
    weekStart: string;
    built: number;
    sent: number;
    clicked: number;
    deliveryPercent: number | null;
    ctrPercent: number | null;
  };
  /** §7 D1/D7 return. */
  retention: ReturnRates & { d1Percent: number | null; d7Percent: number | null };
}

export async function specMetrics(now: Date): Promise<SpecMetrics> {
  // The week just closed, not the one in progress: a Monday-morning read of a
  // week two days old would report a CTR of nearly zero and look like failure.
  const lastWeek = weekStart(new Date(now.getTime() - 7 * 86_400_000));
  const [goals, recap, retention] = await Promise.all([
    goalSetRate(),
    recapMetrics(lastWeek),
    returnRates()
  ]);

  return {
    goals,
    recap: {
      weekStart: recap.weekStart,
      built: recap.weeksBuilt,
      sent: recap.sent,
      clicked: recap.clicked,
      deliveryPercent: returnRate(recap.sent, recap.weeksBuilt),
      ctrPercent: returnRate(recap.clicked, recap.sent)
    },
    retention: {
      ...retention,
      d1Percent: returnRate(retention.d1Returned, retention.d1Cohort),
      d7Percent: returnRate(retention.d7Returned, retention.d7Cohort)
    }
  };
}
