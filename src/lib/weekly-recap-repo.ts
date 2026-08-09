import { randomBytes } from "node:crypto";
import { sql } from "./db";
import { ensureSyncSchema } from "./sync-repo";

/**
 * Recap delivery and click-through, as server-side facts (SPEC §3.3, §7).
 *
 * The CTR number decides whether Phase 3 gets built at all (§7: >25% green-
 * lights it), so it cannot be a client-side event that ad blockers, a closed
 * tab or a Discord link preview can distort. One row per player per week
 * records that a recap was sent and, later, that its link was opened.
 */

interface QueryClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T[]>;
}

function client(): QueryClient {
  return sql() as unknown as QueryClient;
}

/** Monday of the ISO week containing `date`, in UTC. */
export function weekStart(date: Date): string {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // getUTCDay: Sunday is 0. Monday-based weeks make Sunday the seventh day,
  // not the first — a recap sent on Sunday evening must summarise the week
  // that is ending, not open a new one.
  const dayFromMonday = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - dayFromMonday);
  return utc.toISOString().slice(0, 10);
}

export function newRecapToken(): string {
  return randomBytes(18).toString("base64url");
}

export interface WeeklyProgressInput {
  accountId: string;
  weekStart: string;
  xpGained: number;
  levelsGained: number;
  kcGained: Record<string, number>;
  clogSlotsGained: number;
  goalProgress: Record<string, { pctBefore: number; pctAfter: number }>;
  qualifiedForStreak: boolean;
}

/** Materialise the week. Re-running the job overwrites rather than duplicating. */
export async function upsertWeeklyProgress(input: WeeklyProgressInput): Promise<void> {
  await ensureSyncSchema();
  await client().query(`
    INSERT INTO weekly_progress (
      account_id, week_start, xp_gained, levels_gained, kc_gained,
      clog_slots_gained, goal_progress, qualified_for_streak
    )
    VALUES ($1::uuid, $2::date, $3, $4, $5::jsonb, $6, $7::jsonb, $8)
    ON CONFLICT (account_id, week_start) DO UPDATE SET
      xp_gained = EXCLUDED.xp_gained,
      levels_gained = EXCLUDED.levels_gained,
      kc_gained = EXCLUDED.kc_gained,
      clog_slots_gained = EXCLUDED.clog_slots_gained,
      goal_progress = EXCLUDED.goal_progress,
      qualified_for_streak = EXCLUDED.qualified_for_streak
  `, [
    input.accountId, input.weekStart, Math.max(0, Math.round(input.xpGained)),
    Math.max(0, Math.round(input.levelsGained)), JSON.stringify(input.kcGained),
    Math.max(0, Math.round(input.clogSlotsGained)), JSON.stringify(input.goalProgress),
    input.qualifiedForStreak
  ]);
}

/**
 * Claim the right to send this week's recap, atomically.
 *
 * Returns a token on success and null when one was already sent. The guard is
 * the WHERE clause, not a prior read: two cron invocations overlapping — a
 * retry, a manual trigger — would otherwise both see "not sent" and both post
 * to the player's clan Discord. Sending the same recap twice is the fastest
 * way to have the webhook removed.
 */
export async function claimRecapSend(
  accountId: string,
  week: string,
  channel: "discord" | "email"
): Promise<string | null> {
  await ensureSyncSchema();
  const token = newRecapToken();
  const rows = await client().query<{ recap_token: string }>(`
    UPDATE weekly_progress
    SET recap_token = $3, recap_sent_at = NOW(), recap_channel = $4
    WHERE account_id = $1::uuid AND week_start = $2::date AND recap_sent_at IS NULL
    RETURNING recap_token
  `, [accountId, week, token, channel]);
  return rows[0]?.recap_token ?? null;
}

/** Undo a claim when delivery failed, so the next run may try again. */
export async function releaseRecapSend(accountId: string, week: string): Promise<void> {
  await ensureSyncSchema();
  await client().query(`
    UPDATE weekly_progress
    SET recap_token = NULL, recap_sent_at = NULL, recap_channel = NULL
    WHERE account_id = $1::uuid AND week_start = $2::date AND recap_clicked_at IS NULL
  `, [accountId, week]);
}

export interface RecapClick {
  rsn: string;
}

/**
 * Record a click and hand back the RSN to redirect to.
 *
 * Only the FIRST click is stamped: CTR is "did this recap work", and a player
 * who opens the link three times has not tripled anything.
 */
export async function recordRecapClick(token: string): Promise<RecapClick | null> {
  if (!token) return null;
  await ensureSyncSchema();
  const rows = await client().query<{ rsn: string }>(`
    UPDATE weekly_progress w
    SET recap_clicked_at = COALESCE(w.recap_clicked_at, NOW())
    FROM account_identity i
    WHERE w.recap_token = $1 AND i.account_id = w.account_id
    RETURNING i.rsn
  `, [token]);
  return rows[0] ? { rsn: rows[0].rsn } : null;
}

/**
 * How far before the week began a collection-log reading may be taken.
 *
 * Plugin syncs are event-driven, not daily, so "the newest sync before the
 * week" can be months old for anyone who plays without RuneLite open. Without
 * a bound, a January sync and a sync from this week give a seven-month
 * difference labelled "this week". The hiscore baseline has had a bound since
 * it was written; this side had none.
 */
const CLOG_BASELINE_MAX_LEAD_DAYS = 14;

/**
 * Collection-log slot counts either side of a week, from RuneLite syncs.
 *
 * Null on each side that cannot be trusted, and null is not zero:
 *
 *  - no sync at all — a hiscores-only account has never told Scapestack
 *    anything about its log;
 *  - a sync whose collection log was never LOADED. `collection_log_item_ids`
 *    is `INTEGER[] NOT NULL`, so a plugin that omitted the log writes an empty
 *    array and `cardinality` returns 0. Read as a count, that 0 means the
 *    player owned nothing — and the first sync after they finally open the log
 *    interface is then reported as 812 slots banked this week. The row already
 *    records which it was, in `availability->>'collectionLog'`; the previous
 *    version of this query simply did not look;
 *  - a reading from too long before the week to describe it.
 */
export async function clogSlotsAround(
  accountId: string,
  week: string
): Promise<{ before: number | null; after: number | null }> {
  await ensureSyncSchema();
  const rows = await client().query<{ side: string; slots: number; loaded: boolean }>(`
    (SELECT 'before' AS side,
            cardinality(collection_log_item_ids) AS slots,
            COALESCE(availability->>'collectionLog', 'unknown') = 'available' AS loaded
       FROM sync_snapshot
      WHERE account_id = $1::uuid
        AND captured_at < $2::date
        AND captured_at >= $2::date - ($3 || ' days')::interval
      ORDER BY captured_at DESC LIMIT 1)
    UNION ALL
    (SELECT 'after' AS side,
            cardinality(collection_log_item_ids) AS slots,
            COALESCE(availability->>'collectionLog', 'unknown') = 'available' AS loaded
       FROM sync_snapshot
      WHERE account_id = $1::uuid AND captured_at >= $2::date
      ORDER BY captured_at DESC LIMIT 1)
  `, [accountId, week, String(CLOG_BASELINE_MAX_LEAD_DAYS)]);
  const find = (side: string) => {
    const row = rows.find((candidate) => candidate.side === side);
    if (!row || !row.loaded) return null;
    return Number(row.slots);
  };
  return { before: find("before"), after: find("after") };
}

export interface RecapRecipient {
  accountId: string;
  rsn: string;
  discordWebhookUrl: string;
}

/**
 * Players who asked for a recap and have somewhere to receive it.
 *
 * The weekly_progress row does not exist yet when this runs — the job
 * materialises it per account — so the LEFT JOIN is only there to drop
 * accounts already sent to, not to gate on the row existing. Gating on it was
 * the first shape of this query and it selected nobody, forever.
 *
 * Discord only for now: the email columns exist but nothing writes them until
 * a transactional provider is chosen, and a half-built email path that sends
 * to an unverified address is worse than none.
 */
export async function recapCandidates(week: string, limit: number): Promise<RecapRecipient[]> {
  await ensureSyncSchema();
  const rows = await client().query<{ account_id: string; rsn: string; url: string }>(`
    SELECT i.account_id, i.rsn, i.notify_discord_webhook_url AS url
    FROM account_identity i
    LEFT JOIN weekly_progress w
      ON w.account_id = i.account_id AND w.week_start = $1::date
    WHERE i.deletion_requested_at IS NULL
      AND i.notify_weekly_recap
      AND i.notify_discord_webhook_url IS NOT NULL
      AND w.recap_sent_at IS NULL
    ORDER BY i.last_seen_at DESC
    LIMIT $2
  `, [week, limit]);
  return rows.map((row) => ({ accountId: row.account_id, rsn: row.rsn, discordWebhookUrl: row.url }));
}

export interface RecapSettings {
  enabled: boolean;
  discordWebhookUrl: string | null;
}

export async function getRecapSettings(accountId: string): Promise<RecapSettings> {
  await ensureSyncSchema();
  const rows = await client().query<{ enabled: boolean; url: string | null }>(`
    SELECT notify_weekly_recap AS enabled, notify_discord_webhook_url AS url
    FROM account_identity WHERE account_id = $1::uuid
  `, [accountId]);
  return { enabled: rows[0]?.enabled ?? true, discordWebhookUrl: rows[0]?.url ?? null };
}

/**
 * `discordWebhookUrl: undefined` leaves the webhook alone; `null` removes it.
 * Two different instructions, and folding them together would make the field
 * impossible to clear once set.
 */
export async function setRecapSettings(
  accountId: string,
  input: { enabled: boolean; discordWebhookUrl?: string | null }
): Promise<void> {
  await ensureSyncSchema();
  if (input.discordWebhookUrl === undefined) {
    await client().query(
      `UPDATE account_identity SET notify_weekly_recap = $2 WHERE account_id = $1::uuid`,
      [accountId, input.enabled]
    );
    return;
  }
  await client().query(`
    UPDATE account_identity
    SET notify_weekly_recap = $2, notify_discord_webhook_url = $3
    WHERE account_id = $1::uuid
  `, [accountId, input.enabled, input.discordWebhookUrl]);
}

/** Forget a webhook Discord has told us is gone. The player can set a new one. */
export async function clearDiscordWebhook(accountId: string): Promise<void> {
  await ensureSyncSchema();
  await client().query(
    `UPDATE account_identity SET notify_discord_webhook_url = NULL WHERE account_id = $1::uuid`,
    [accountId]
  );
}

export interface RecapDeliveryMetrics {
  weekStart: string;
  /** Every week materialised, quiet ones included. Context, not a denominator. */
  weeksBuilt: number;
  /** Weeks that had something in them, so a recap was owed. */
  sendable: number;
  sent: number;
  clicked: number;
}

/**
 * §7's recap numbers, read from the ledger rather than from an analytics call.
 *
 * Delivery is sent/SENDABLE, not sent/built. A quiet week is materialised —
 * the streak and the history want it — and deliberately never sent, so
 * counting it in the denominator turned "nothing failed" into "40% delivery"
 * under a heading that decides whether Phase 3 gets built.
 *
 * `qualified_for_streak` is the same predicate the job uses to decide whether
 * to send, so the two cannot drift apart.
 */
export async function recapMetrics(week: string): Promise<RecapDeliveryMetrics> {
  await ensureSyncSchema();
  const rows = await client().query<{ built: string; sendable: string; sent: string; clicked: string }>(`
    SELECT COUNT(*) AS built,
           COUNT(*) FILTER (WHERE qualified_for_streak) AS sendable,
           COUNT(recap_sent_at) AS sent,
           COUNT(recap_clicked_at) AS clicked
    FROM weekly_progress
    WHERE week_start = $1::date
  `, [week]);
  const row = rows[0];
  return {
    weekStart: week,
    weeksBuilt: Number(row?.built ?? 0),
    sendable: Number(row?.sendable ?? 0),
    sent: Number(row?.sent ?? 0),
    clicked: Number(row?.clicked ?? 0)
  };
}
