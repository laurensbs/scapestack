import { createHash, randomBytes, randomUUID } from "node:crypto";
import { sql } from "./db";
import { ensureSyncSchema } from "./sync-repo";

const PAIRING_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PAIRING_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

interface QueryClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T[]>;
}

function client(): QueryClient {
  return sql() as unknown as QueryClient;
}

export interface ConnectedAccount {
  accountId: string;
  rsn: string;
  displayName: string;
  lastSeenAt: string;
}

export type StartPairingResult =
  | { status: "created"; pairingId: string; code: string; browserSecret: string; expiresAt: string }
  | { status: "rate-limited" }
  | { status: "unclaimed" };

export type CompletePairingResult =
  | { status: "connected"; sessionToken: string; expiresAt: string; account: ConnectedAccount }
  | { status: "pending" | "expired" | "invalid" };

function normalizeRsn(rsn: string): string {
  return rsn.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 12);
}

export function hashAccountSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function normalizePairingCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export function formatPairingCode(code: string): string {
  const clean = normalizePairingCode(code);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

export function generatePairingCode(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (const byte of bytes) code += PAIRING_ALPHABET[byte % PAIRING_ALPHABET.length];
  return code;
}

function accountFromRow(row: {
  account_id: string;
  rsn: string;
  display_name: string;
  last_seen_at: string;
}): ConnectedAccount {
  return {
    accountId: row.account_id,
    rsn: row.rsn,
    displayName: row.display_name || row.rsn,
    lastSeenAt: new Date(row.last_seen_at).toISOString()
  };
}

export async function startAccountPairing(rsn: string, now = new Date()): Promise<StartPairingResult> {
  const normalizedRsn = normalizeRsn(rsn);
  if (!normalizedRsn) return { status: "unclaimed" };
  await ensureSyncSchema();
  const accounts = await client().query<{ account_id: string; recent_pairings: number | string }>(`
    SELECT identity.account_id,
           (SELECT COUNT(*) FROM account_pairing recent
            WHERE recent.account_id = identity.account_id
              AND recent.created_at > $2::timestamptz - INTERVAL '1 minute') AS recent_pairings
    FROM account_identity identity
    JOIN player_claim claim ON claim.account_id = identity.account_id
    WHERE identity.rsn = $1 AND claim.token_hash <> ''
    LIMIT 1
  `, [normalizedRsn, now.toISOString()]);
  const accountId = accounts[0]?.account_id;
  if (!accountId) return { status: "unclaimed" };
  if (Number(accounts[0]?.recent_pairings ?? 0) >= 5) return { status: "rate-limited" };

  await client().query(`
    DELETE FROM account_pairing
    WHERE account_id = $1 AND expires_at <= $2::timestamptz
  `, [accountId, now.toISOString()]);

  const pairingId = randomUUID();
  const code = generatePairingCode();
  const browserSecret = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + PAIRING_TTL_MS).toISOString();
  await client().query(`
    INSERT INTO account_pairing (
      pairing_id, account_id, rsn, code_hash, browser_secret_hash,
      status, created_at, expires_at
    ) VALUES ($1, $2, $3, $4, $5, 'pending', $6::timestamptz, $7::timestamptz)
  `, [pairingId, accountId, normalizedRsn, hashAccountSecret(code),
    hashAccountSecret(browserSecret), now.toISOString(), expiresAt]);
  return { status: "created", pairingId, code: formatPairingCode(code), browserSecret, expiresAt };
}

export async function approveAccountPairing(
  rsn: string,
  code: string,
  now = new Date()
): Promise<"approved" | "not-found"> {
  const normalizedRsn = normalizeRsn(rsn);
  const normalizedCode = normalizePairingCode(code);
  if (!normalizedRsn || normalizedCode.length !== 8) return "not-found";
  await ensureSyncSchema();
  const rows = await client().query<{ pairing_id: string }>(`
    UPDATE account_pairing pairing
    SET status = 'approved', approved_at = $3::timestamptz
    FROM account_identity identity
    WHERE pairing.account_id = identity.account_id
      AND identity.rsn = $1
      AND pairing.code_hash = $2
      AND pairing.status = 'pending'
      AND pairing.expires_at > $3::timestamptz
    RETURNING pairing.pairing_id
  `, [normalizedRsn, hashAccountSecret(normalizedCode), now.toISOString()]);
  return rows[0] ? "approved" : "not-found";
}

export async function completeAccountPairing(
  pairingId: string,
  browserSecret: string,
  now = new Date()
): Promise<CompletePairingResult> {
  if (!pairingId || !browserSecret) return { status: "invalid" };
  await ensureSyncSchema();
  const sessionId = randomUUID();
  const sessionToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  const rows = await client().query<{
    account_id: string;
    rsn: string;
    display_name: string;
    last_seen_at: string;
  }>(`
    WITH consumed AS (
      UPDATE account_pairing
      SET status = 'consumed', consumed_at = $5::timestamptz
      WHERE pairing_id = $1::uuid
        AND browser_secret_hash = $2
        AND status = 'approved'
        AND expires_at > $5::timestamptz
      RETURNING account_id
    ), session AS (
      INSERT INTO account_browser_session (
        session_id, account_id, token_hash, created_at, last_used_at, expires_at
      )
      SELECT $3::uuid, account_id, $4, $5::timestamptz, $5::timestamptz, $6::timestamptz
      FROM consumed
      RETURNING account_id
    )
    SELECT identity.account_id, identity.rsn, identity.display_name, identity.last_seen_at
    FROM account_identity identity
    JOIN session ON session.account_id = identity.account_id
  `, [pairingId, hashAccountSecret(browserSecret), sessionId, hashAccountSecret(sessionToken),
    now.toISOString(), expiresAt]);
  if (rows[0]) {
    return { status: "connected", sessionToken, expiresAt, account: accountFromRow(rows[0]) };
  }

  const state = await client().query<{ status: string; expires_at: string }>(`
    SELECT status, expires_at
    FROM account_pairing
    WHERE pairing_id = $1::uuid AND browser_secret_hash = $2
    LIMIT 1
  `, [pairingId, hashAccountSecret(browserSecret)]);
  if (!state[0]) return { status: "invalid" };
  if (new Date(state[0].expires_at).getTime() <= now.getTime() || state[0].status === "expired") {
    return { status: "expired" };
  }
  return { status: state[0].status === "pending" ? "pending" : "invalid" };
}

export async function getConnectedAccount(sessionToken: string, now = new Date()): Promise<ConnectedAccount | null> {
  if (!sessionToken) return null;
  await ensureSyncSchema();
  const rows = await client().query<{
    account_id: string;
    rsn: string;
    display_name: string;
    last_seen_at: string;
  }>(`
    WITH active AS (
      UPDATE account_browser_session
      SET last_used_at = $2::timestamptz
      WHERE token_hash = $1
        AND revoked_at IS NULL
        AND expires_at > $2::timestamptz
      RETURNING account_id
    )
    SELECT identity.account_id, identity.rsn, identity.display_name, identity.last_seen_at
    FROM account_identity identity
    JOIN active ON active.account_id = identity.account_id
  `, [hashAccountSecret(sessionToken), now.toISOString()]);
  return rows[0] ? accountFromRow(rows[0]) : null;
}

export async function revokeBrowserSession(sessionToken: string, now = new Date()): Promise<void> {
  if (!sessionToken) return;
  await ensureSyncSchema();
  await client().query(`
    UPDATE account_browser_session
    SET revoked_at = COALESCE(revoked_at, $2::timestamptz)
    WHERE token_hash = $1
  `, [hashAccountSecret(sessionToken), now.toISOString()]);
}

export const accountPairingLimits = {
  pairingTtlMs: PAIRING_TTL_MS,
  sessionTtlMs: SESSION_TTL_MS,
  startsPerMinute: 5
} as const;
