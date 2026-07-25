// Plugin sync auth — first-claim-wins.
//
// Each Scapestack plugin install generates a UUID token on first run
// (held in RuneLite config-storage). The plugin's first sync POSTs to
// /api/sync/claim with { rsn } plus Authorization: Bearer <token>. We:
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
import { normalizeRsn } from "./rsn";

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

// Shared with the pairing + sync paths so one player never gets two keys.
const normalize = normalizeRsn;

export interface ClaimResult {
  ok: boolean;
  reason?: string;
  /** Always returns the existing token-hash binding when present, so the
   *  caller can decide whether the incoming claim matches it (re-run of
   *  the same plugin install) or conflicts (different install). */
  existingTokenHash?: string;
}

export async function hasExistingClaim(rsn: string): Promise<boolean> {
  if (!hasDatabase()) return false;
  const norm = normalize(rsn);
  if (!norm) return false;
  try {
    const rows = await sql()`
      SELECT token_hash FROM player_claim WHERE rsn = ${norm} LIMIT 1
    ` as Array<{ token_hash: string }>;
    return Boolean(rows[0]?.token_hash);
  } catch {
    console.error("hasExistingClaim failed");
    return false;
  }
}

/** Records a claim. First call for a given RSN wins; subsequent calls
 *  with a different token-hash get rejected.
 *
 *  `accountHash` is RuneLite's per-OSRS-account identifier. It is what
 *  distinguishes the two cases that look identical from the token alone:
 *
 *    rename  — same account, new name  → move the identity and its history
 *    switch  — same install, other character → give it its own claim
 *
 *  Before this was modelled, every switch was treated as a rename: the other
 *  character's player_sync row was deleted and its whole ledger was re-pointed
 *  at the new name. Playing a main and an ironman on one RuneLite install
 *  destroyed data on every login.
 *
 *  Plugin builds before 0.4.0 send no accountHash. For those we take the safe
 *  branch — a second claim row, nothing moved, nothing deleted. player_claim
 *  is keyed on rsn with no unique constraint on token_hash, so one install
 *  holding several characters has always been representable. */
export async function recordClaim(
  rsn: string,
  token: string,
  accountHash?: string | null
): Promise<ClaimResult> {
  if (!hasDatabase()) return { ok: false, reason: "Database not configured" };
  const norm = normalize(rsn);
  if (!norm) return { ok: false, reason: "Invalid RSN" };
  const hash = hashToken(token);
  const account = accountHash && accountHash.trim() ? accountHash.trim().slice(0, 64) : null;

  try {
    const targetRows = await sql()`
      SELECT token_hash FROM player_claim WHERE rsn = ${norm} LIMIT 1
    ` as Array<{ token_hash: string }>;
    const targetHash = targetRows[0]?.token_hash;
    if (targetHash) {
      if (targetHash !== hash) {
        return { ok: false, reason: "RSN already claimed by another install", existingTokenHash: targetHash };
      }
      // Same install re-confirming a claim it already holds. Record the
      // account hash the first time the plugin is new enough to send one.
      if (account) {
        await sql()`
          UPDATE player_claim
          SET account_hash = ${account}, last_used_at = NOW()
          WHERE rsn = ${norm} AND account_hash IS DISTINCT FROM ${account}
        `;
      }
      return { ok: true };
    }

    // Only an account-hash match proves this is the same OSRS account under a
    // new name. Without one we must not touch the other character's rows.
    const installRows = account
      ? await sql()`
          SELECT rsn, token_hash FROM player_claim
          WHERE token_hash = ${hash} AND account_hash = ${account}
          LIMIT 1
        ` as Array<{ rsn?: string; token_hash: string }>
      : [];
    const previousRsn = installRows[0]?.rsn;
    if (previousRsn && previousRsn !== norm) {
      const migrated = await sql()`
        WITH source_claim AS (
          SELECT rsn, account_id FROM player_claim
          WHERE token_hash = ${hash} AND rsn = ${previousRsn}
          LIMIT 1
        ), target_conflict AS (
          SELECT account_id FROM account_identity WHERE rsn = ${norm}
        ), moved_sync AS (
          -- Carry the snapshot across instead of deleting it. rsn is the
          -- primary key here, so the row simply moves to the new name and the
          -- player keeps their quests, diaries, bank and Slayer state.
          UPDATE player_sync
          SET rsn = ${norm}
          WHERE rsn = ${previousRsn}
            AND NOT EXISTS (SELECT 1 FROM target_conflict)
            AND NOT EXISTS (SELECT 1 FROM player_sync existing WHERE existing.rsn = ${norm})
          RETURNING rsn
        ), moved_identity AS (
          UPDATE account_identity
          SET rsn = ${norm}, last_seen_at = NOW()
          WHERE account_id = (SELECT account_id FROM source_claim)
            AND NOT EXISTS (SELECT 1 FROM target_conflict)
          RETURNING account_id
        ), moved_claim AS (
          UPDATE player_claim
          SET rsn = ${norm}, last_used_at = NOW()
          WHERE token_hash = ${hash} AND rsn = ${previousRsn}
            AND EXISTS (SELECT 1 FROM moved_identity)
          RETURNING rsn
        )
        SELECT EXISTS(SELECT 1 FROM moved_claim) AS migrated
      ` as Array<{ migrated: boolean }>;
      if (migrated[0]?.migrated) return { ok: true };
      return { ok: false, reason: "New RSN is already connected to another account" };
    }

    // Atomic insert-or-noop. A concurrent first claim is resolved by the
    // final hash comparison below. This is also the path a second character
    // on the same install takes: its own row, alongside the first one.
    await sql()`
      INSERT INTO player_claim (rsn, token_hash, account_hash, last_used_at)
      VALUES (${norm}, ${hash}, ${account}, NOW())
      ON CONFLICT (rsn) DO NOTHING
    `;
    const rows = await sql()`
      SELECT token_hash FROM player_claim WHERE rsn = ${norm} LIMIT 1
    ` as Array<{ token_hash: string }>;
    const stored = rows[0]?.token_hash;
    if (!stored) return { ok: false, reason: "Claim row missing after insert" };
    if (stored === hash) return { ok: true };
    return { ok: false, reason: "RSN already claimed by another install", existingTokenHash: stored };
  } catch {
    console.error("recordClaim failed");
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
  } catch {
    console.error("verifyClaim failed");
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
