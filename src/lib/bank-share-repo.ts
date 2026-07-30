import { randomBytes } from "node:crypto";
import { affordabilityReport } from "./bank-affordability";
import {
  bankSharePath,
  buildBankShareSnapshot,
  parseBankShareSnapshot,
  validBankShareId,
  type BankShareSnapshot,
  type PublicBankShare
} from "./bank-share";
import { sql } from "./db";
import { shouldUsePluginBank } from "./plugin-bank-status";
import { ensureSyncSchema, getSyncedPlayer } from "./sync-repo";

interface QueryClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T[]>;
}

function client(): QueryClient {
  return sql() as unknown as QueryClient;
}

export type CreateBankShareResult =
  | { status: "created"; shareId: string; snapshot: BankShareSnapshot }
  | { status: "no-bank" | "iron-account" | "no-affordable-sets" };

export function generateBankShareId(): string {
  return randomBytes(18).toString("base64url");
}

export async function createPrivateBankShare(input: {
  accountId: string;
  rsn: string;
  displayName: string;
  now?: Date;
}): Promise<CreateBankShareResult> {
  await ensureSyncSchema();
  const player = await getSyncedPlayer(input.rsn);
  if (!player || !shouldUsePluginBank({
    status: player.bankStatus,
    itemCount: player.bankItems.length,
    availability: player.availability?.bank
  })) {
    return { status: "no-bank" };
  }
  if (player.accountType !== "normal") return { status: "iron-account" };
  const report = await affordabilityReport(player.bankItems);
  const now = input.now ?? new Date();
  const snapshot = buildBankShareSnapshot({
    displayName: input.displayName || player.displayName,
    report,
    sourceSyncedAt: player.syncedAt,
    pricedAt: now.toISOString()
  });
  if (!snapshot) return { status: "no-affordable-sets" };
  const shareId = generateBankShareId();
  await client().query(`
    INSERT INTO bank_affordability_share (
      share_id, account_id, snapshot, source_synced_at, created_at
    ) VALUES ($1, $2::uuid, $3::jsonb, $4::timestamptz, $5::timestamptz)
  `, [shareId, input.accountId, JSON.stringify(snapshot), snapshot.sourceSyncedAt, now.toISOString()]);
  return { status: "created", shareId, snapshot };
}

export async function publishBankShare(
  accountId: string,
  shareId: string,
  now = new Date()
): Promise<{ shareId: string; publicPath: string } | null> {
  if (!validBankShareId(shareId)) return null;
  await ensureSyncSchema();
  const rows = await client().query<{ share_id: string }>(`
    UPDATE bank_affordability_share
    SET published_at = $3::timestamptz, revoked_at = NULL
    WHERE share_id = $1 AND account_id = $2::uuid
    RETURNING share_id
  `, [shareId, accountId, now.toISOString()]);
  const id = rows[0]?.share_id;
  const publicPath = id ? bankSharePath(id) : null;
  return id && publicPath ? { shareId: id, publicPath } : null;
}

export async function unpublishBankShare(
  accountId: string,
  shareId: string,
  now = new Date()
): Promise<boolean> {
  if (!validBankShareId(shareId)) return false;
  await ensureSyncSchema();
  const rows = await client().query<{ share_id: string }>(`
    UPDATE bank_affordability_share
    SET revoked_at = $3::timestamptz
    WHERE share_id = $1 AND account_id = $2::uuid AND published_at IS NOT NULL
    RETURNING share_id
  `, [shareId, accountId, now.toISOString()]);
  return Boolean(rows[0]);
}

export async function getPublicBankShare(shareId: string): Promise<PublicBankShare | null> {
  if (!validBankShareId(shareId)) return null;
  let rows: Array<{ share_id: string; snapshot: unknown; published_at: string }>;
  try {
    rows = await client().query(`
      SELECT share_id, snapshot, published_at
      FROM bank_affordability_share
      WHERE share_id = $1 AND published_at IS NOT NULL AND revoked_at IS NULL
      LIMIT 1
    `, [shareId]);
  } catch {
    return null;
  }
  const row = rows[0];
  const snapshot = row ? parseBankShareSnapshot(row.snapshot) : null;
  if (!row || !snapshot) return null;
  return {
    shareId: row.share_id,
    snapshot,
    publishedAt: new Date(row.published_at).toISOString()
  };
}
