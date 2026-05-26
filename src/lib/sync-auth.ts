// Plugin sync auth — first-claim-wins.
//
// Each Scapestack plugin install generates a UUID token on first run
// (held in RuneLite config-storage). The plugin's first sync POSTs to
// /api/sync/claim with { rsn, token, hiscoresName? }. We:
//   1. Verify the RSN exists on the OSRS Hiscores (best-effort).
//   2. Hash the token and store rsn → token_hash. First write wins.
//   3. On every subsequent /api/sync, require Authorization: Bearer
//      <token> and verify hash matches the stored claim.
//
// Threat model:
//   ❌ Catches: a player POSTing fake data under someone else's RSN.
//      They'd need to know that player's token, which only the original
//      plugin install has.
//   ⚠️  Misses: the first-mover problem. If a griefer claims an RSN
//      before the real owner ever installs the plugin, the real owner
//      can't sync. We add a /api/sync/reclaim endpoint later (proof of
//      ownership via in-game message or similar) but it's out of scope
//      for v0.2.
//   ⚠️  No transport encryption beyond HTTPS — token travels in plain
//      text inside the bearer header. That's standard for OAuth-style
//      tokens; HTTPS is enough for this threat level.

import { createHash, randomUUID } from "node:crypto";
import { sql, hasDatabase } from "./db";

/** Hashed-token form we store in the DB. Never store the raw token. */
function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Extracts the bearer token from the Authorization header, or null
 *  when the header is missing/malformed. */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+([A-Za-z0-9\-_.~]{16,200})$/);
  return m ? m[1] : null;
}

function normalize(rsn: string): string {
  return rsn.trim().toLowerCase().slice(0, 12);
}

export interface ClaimResult {
  ok: boolean;
  reason?: string;
  /** Always returns the existing token-hash binding when present, so the
   *  caller can decide whether the incoming claim matches it (re-run of
   *  the same plugin install) or conflicts (different install). */
  existingTokenHash?: string;
}

/** Records a claim. First call for a given RSN wins; subsequent calls
 *  with a different token-hash get rejected. */
export async function recordClaim(rsn: string, token: string): Promise<ClaimResult> {
  if (!hasDatabase()) return { ok: false, reason: "Database not configured" };
  const norm = normalize(rsn);
  if (!norm) return { ok: false, reason: "Invalid RSN" };
  const hash = hashToken(token);

  // Atomic insert-or-noop: pg's ON CONFLICT DO NOTHING returns no rows
  // when the row already existed. We then SELECT to check whether the
  // existing row's hash matches ours.
  try {
    await sql()`
      INSERT INTO player_claim (rsn, token_hash, last_used_at)
      VALUES (${norm}, ${hash}, NOW())
      ON CONFLICT (rsn) DO NOTHING
    `;
    const rows = await sql()`
      SELECT token_hash FROM player_claim WHERE rsn = ${norm} LIMIT 1
    ` as Array<{ token_hash: string }>;
    const stored = rows[0]?.token_hash;
    if (!stored) return { ok: false, reason: "Claim row missing after insert" };
    if (stored === hash) return { ok: true };
    return { ok: false, reason: "RSN already claimed by another install", existingTokenHash: stored };
  } catch (err) {
    console.error("recordClaim failed:", err);
    return { ok: false, reason: "Database error" };
  }
}

/** Verifies that a bearer token is bound to the given RSN. Used by the
 *  main /api/sync endpoint to reject fake POSTs. */
export async function verifyClaim(rsn: string, token: string): Promise<boolean> {
  if (!hasDatabase()) return false;
  const norm = normalize(rsn);
  if (!norm) return false;
  const hash = hashToken(token);
  try {
    const rows = await sql()`
      SELECT token_hash FROM player_claim WHERE rsn = ${norm} LIMIT 1
    ` as Array<{ token_hash: string }>;
    const stored = rows[0]?.token_hash;
    if (!stored) return false;
    if (stored !== hash) return false;
    // Touch last_used_at for observability — lets us spot stale claims
    // that can be GC'd later.
    await sql()`
      UPDATE player_claim SET last_used_at = NOW() WHERE rsn = ${norm}
    `;
    return true;
  } catch (err) {
    console.error("verifyClaim failed:", err);
    return false;
  }
}

/** Used in tests + the claim endpoint to generate a new token. Wraps
 *  randomUUID so we can mock it. */
export function generateInstallToken(): string {
  return randomUUID();
}

/** Pure utility — exported so the test suite can verify the hash is
 *  deterministic + tokens don't collide. */
export const __test = { hashToken };
