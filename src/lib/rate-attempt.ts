// A counter for the limits that have no account to hang off yet.
//
// Two callers, both from SPEC §2.3: the on-demand refresh (1 per RSN per 10
// minutes) and first registration (per source address). Neither can key on an
// account — the refresh is what proves an account should exist, and the
// registration is what creates it.
//
// Only digests are stored. The threat model forbids keeping an address, and a
// counter has never needed the plaintext.
//
// Attempts are recorded whether or not they are allowed, because a caller
// hammering the endpoint generates mostly refusals and a limiter that only
// counts successes is not a limiter.

import { createHash } from "node:crypto";
import { hasDatabase, sql } from "./db";
import { ensureSyncSchema } from "./sync-repo";

interface QueryClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T[]>;
}

function client(): QueryClient {
  return sql() as unknown as QueryClient;
}

export const RATE_LIMITS = {
  /** §2.3: on-demand refresh, one per RSN per 10 minutes. */
  refreshPerRsn: { scope: "hiscore_refresh", limit: 1, windowMinutes: 10 },
  /**
   * First registration per source address. Well above a real session — a
   * player looks up their main, an ironman, a couple of friends — and low
   * enough that walking the hiscores to inflate the cron roster is not free.
   */
  registerPerAddress: { scope: "account_register", limit: 20, windowMinutes: 60 }
} as const;

export interface RateLimitRule {
  scope: string;
  limit: number;
  windowMinutes: number;
}

export interface RateVerdict {
  allowed: boolean;
  /** Seconds until the next attempt would be allowed. 0 when allowed. */
  retryAfterSeconds: number;
}

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Records this attempt and reports whether it may proceed.
 *
 * Fails OPEN, deliberately and narrowly: both callers sit in front of an
 * action that is independently safe (a hiscores read that is cached for five
 * minutes, and a registration that requires the RSN to exist on the hiscores).
 * A database hiccup locking every player out of "Refresh now" would be the
 * larger failure. Anything guarding a write that is not otherwise checked
 * should not use this.
 */
export async function checkAndRecordAttempt(rule: RateLimitRule, key: string): Promise<RateVerdict> {
  if (!hasDatabase()) return { allowed: true, retryAfterSeconds: 0 };
  const keyHash = hash(`${rule.scope}:${key}`);
  try {
    await ensureSyncSchema();
    // Housekeeping first, so the table stays bounded without a scheduled job.
    // Scoped to this key: a global sweep on every call is a table scan.
    await client().query(
      `DELETE FROM rate_attempt
       WHERE scope = $1 AND key_hash = $2
         AND created_at < NOW() - ($3 * INTERVAL '1 minute')`,
      [rule.scope, keyHash, rule.windowMinutes]
    );
    const rows = await client().query<{ used: number; oldest: string | null }>(
      `SELECT COUNT(*)::int AS used, MIN(created_at) AS oldest
       FROM rate_attempt
       WHERE scope = $1 AND key_hash = $2
         AND created_at > NOW() - ($3 * INTERVAL '1 minute')`,
      [rule.scope, keyHash, rule.windowMinutes]
    );
    await client().query(
      `INSERT INTO rate_attempt (scope, key_hash) VALUES ($1, $2)`,
      [rule.scope, keyHash]
    );

    const used = rows[0]?.used ?? 0;
    if (used < rule.limit) return { allowed: true, retryAfterSeconds: 0 };

    const oldest = rows[0]?.oldest ? new Date(rows[0].oldest).getTime() : Date.now();
    const freeAt = oldest + rule.windowMinutes * 60_000;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((freeAt - Date.now()) / 1000))
    };
  } catch (error) {
    console.error("rate limit check failed", {
      scope: rule.scope,
      name: error instanceof Error ? error.name : "UnknownError"
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
