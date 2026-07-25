// Rate limiting for /api/sync/claim.
//
// The endpoint is unauthenticated by necessity — the caller is claiming an
// identity, so there is nothing to authenticate against yet. That made it an
// unmetered way to walk the Hiscores and claim names in bulk.
//
// Expiry (see UNUSED_CLAIM_TTL_HOURS in sync-auth.ts) is what removes the
// *payoff* of a land grab: an unused claim releases after a day. This removes
// the *rate*. Both matter — expiry alone still lets an attacker re-grab names
// on a loop, and a rate limit alone still lets a slow grab succeed forever.
//
// Limits are deliberately far above real use. A player's install claims their
// main, maybe an ironman, maybe an alt — a handful over the lifetime of the
// install, not per hour.
//
// Attempts are recorded whether or not they succeed, because an attacker
// enumerating names generates mostly failures. Rows outside the longest window
// are deleted on write, so the table stays small without a scheduled job.

import { createHash } from "node:crypto";
import { sql, hasDatabase } from "./db";

export const CLAIM_LIMITS = {
  /** Per install token, per hour. */
  perTokenHourly: 10,
  /** Per source address, per hour. Higher: a household or a CGNAT egress can
   *  legitimately hold several installs. */
  perIpHourly: 30,
  /** Longest window we keep rows for. */
  retentionHours: 24
} as const;

export type ClaimRateVerdict =
  | { allowed: true }
  | { allowed: false; scope: "token" | "ip" };

/** The threat model forbids storing an IP, and a hash is all a counter needs. */
function hashIp(ip: string): string {
  return createHash("sha256").update(ip, "utf8").digest("hex");
}

/**
 * Best-effort source address. Vercel sets x-forwarded-for; the left-most entry
 * is the client. Spoofable in principle, which is why this is the weaker of the
 * two limits and never the only defence.
 */
export function clientAddressFrom(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return request.headers.get("x-real-ip")?.trim().slice(0, 64) ?? "unknown";
}

/**
 * Records this attempt and reports whether it may proceed.
 *
 * Fails open. A database hiccup must not lock every player out of setting up
 * the plugin — the claim itself is still guarded by first-claim-wins and by the
 * Hiscores existence check.
 */
export async function checkAndRecordClaimAttempt(input: {
  address: string;
  token: string;
}): Promise<ClaimRateVerdict> {
  if (!hasDatabase()) return { allowed: true };
  const ipHash = hashIp(input.address);
  const tokenHash = createHash("sha256").update(input.token, "utf8").digest("hex");

  try {
    await sql()`
      DELETE FROM claim_attempt
      WHERE created_at < NOW() - (${CLAIM_LIMITS.retentionHours} * INTERVAL '1 hour')
    `;
    const rows = await sql()`
      SELECT
        COUNT(*) FILTER (
          WHERE token_hash = ${tokenHash} AND created_at > NOW() - INTERVAL '1 hour'
        )::int AS token_hourly,
        COUNT(*) FILTER (
          WHERE ip_hash = ${ipHash} AND created_at > NOW() - INTERVAL '1 hour'
        )::int AS ip_hourly
      FROM claim_attempt
    ` as Array<{ token_hourly: number; ip_hourly: number }>;

    await sql()`
      INSERT INTO claim_attempt (ip_hash, token_hash) VALUES (${ipHash}, ${tokenHash})
    `;

    const tokenHourly = rows[0]?.token_hourly ?? 0;
    const ipHourly = rows[0]?.ip_hourly ?? 0;
    if (tokenHourly >= CLAIM_LIMITS.perTokenHourly) return { allowed: false, scope: "token" };
    if (ipHourly >= CLAIM_LIMITS.perIpHourly) return { allowed: false, scope: "ip" };
    return { allowed: true };
  } catch {
    console.error("claim rate limit check failed");
    return { allowed: true };
  }
}
