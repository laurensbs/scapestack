import {
  formatGpExact,
  type AffordabilityReport,
  type AffordableSet
} from "./bank-affordability";

export const BANK_SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{24}$/;

export interface BankShareRow {
  setName: string;
  owned: number;
  total: number;
  missing: string[];
  cost: number;
  verdict: string;
  gate: "ready" | "test";
}

export interface BankShareSnapshot {
  version: 1;
  displayName: string;
  gp: number;
  rows: BankShareRow[];
  sourceSyncedAt: string;
  pricedAt: string;
}

export interface PublicBankShare {
  shareId: string;
  snapshot: BankShareSnapshot;
  publishedAt: string;
}

function compact(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function rowFromSet(set: AffordableSet): BankShareRow | null {
  if (set.cost === null || set.affordable === null || set.remainingGp === null) return null;
  const cost = Math.max(0, Math.round(set.cost));
  return {
    setName: compact(set.setName, 80),
    owned: Math.max(0, Math.floor(set.owned)),
    total: Math.max(1, Math.floor(set.total)),
    missing: set.missing.map((piece) => compact(piece.name, 80)).filter(Boolean).slice(0, 8),
    cost,
    verdict: set.affordable
      ? "Buy now"
      : `Short ${formatGpExact(Math.max(0, Math.round(-set.remainingGp)))}`,
    gate: set.affordable ? "ready" : "test"
  };
}

/** Freeze only the answer, never the raw bank that produced it. */
export function buildBankShareSnapshot(input: {
  displayName: string;
  report: AffordabilityReport;
  sourceSyncedAt: string;
  pricedAt: string;
}): BankShareSnapshot | null {
  if (input.report.pricesUnavailable) return null;
  const rows = [
    ...input.report.buyableNow.slice(0, 4),
    ...input.report.shortBy.slice(0, 2)
  ].map(rowFromSet).filter((row): row is BankShareRow => row !== null && row.missing.length > 0);
  if (rows.length === 0) return null;
  return {
    version: 1,
    displayName: compact(input.displayName, 12),
    gp: Math.max(0, Math.round(input.report.gp)),
    rows,
    sourceSyncedAt: new Date(input.sourceSyncedAt).toISOString(),
    pricedAt: new Date(input.pricedAt).toISOString()
  };
}

export function validBankShareId(value: string): boolean {
  return BANK_SHARE_ID_PATTERN.test(value);
}

export function bankSharePath(shareId: string): string | null {
  return validBankShareId(shareId) ? `/share/bank/${shareId}` : null;
}

export function parseBankShareSnapshot(value: unknown): BankShareSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<BankShareSnapshot>;
  if (raw.version !== 1 || typeof raw.displayName !== "string" || !raw.displayName.trim()) return null;
  if (typeof raw.gp !== "number" || !Number.isFinite(raw.gp) || raw.gp < 0) return null;
  if (typeof raw.sourceSyncedAt !== "string" || typeof raw.pricedAt !== "string") return null;
  if (!Number.isFinite(new Date(raw.sourceSyncedAt).getTime()) || !Number.isFinite(new Date(raw.pricedAt).getTime())) return null;
  if (!Array.isArray(raw.rows) || raw.rows.length < 1 || raw.rows.length > 6) return null;
  const rows: BankShareRow[] = [];
  for (const candidate of raw.rows) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const row = candidate as Partial<BankShareRow>;
    if (typeof row.setName !== "string" || !row.setName.trim()) return null;
    if (typeof row.owned !== "number" || typeof row.total !== "number" || row.owned < 0 || row.total < 1) return null;
    if (!Array.isArray(row.missing) || row.missing.length < 1 || row.missing.length > 8 || row.missing.some((name) => typeof name !== "string" || !name.trim())) return null;
    if (typeof row.cost !== "number" || !Number.isFinite(row.cost) || row.cost < 0) return null;
    if (typeof row.verdict !== "string" || (row.gate !== "ready" && row.gate !== "test")) return null;
    rows.push({
      setName: compact(row.setName, 80),
      owned: Math.floor(row.owned),
      total: Math.floor(row.total),
      missing: row.missing.map((name) => compact(name, 80)),
      cost: Math.round(row.cost),
      verdict: compact(row.verdict, 60),
      gate: row.gate
    });
  }
  return {
    version: 1,
    displayName: compact(raw.displayName, 12),
    gp: Math.round(raw.gp),
    rows,
    sourceSyncedAt: new Date(raw.sourceSyncedAt).toISOString(),
    pricedAt: new Date(raw.pricedAt).toISOString()
  };
}
