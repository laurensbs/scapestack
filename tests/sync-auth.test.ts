// Auth-flow tests for the plugin-sync first-claim-wins scheme.
//
// We stub `@/lib/db` so the module thinks it has a database and so we can
// inspect / drive the SQL tagged-template calls. Each test resets the
// stub state in beforeEach.

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------- DB mock ----------
// The module under test (`src/lib/sync-auth.ts`) imports `sql` and
// `hasDatabase` from `@/lib/db`. We replace both with controllable stubs.

interface FakeRow { token_hash: string }

const dbState: {
  hasDb: boolean;
  rows: FakeRow[];                  // what the next SELECT returns
  insertedHashes: string[];         // captured by ON CONFLICT inserts
  updatedRsns: string[];            // captured by UPDATE last_used_at
  conflictOnInsert: boolean;        // simulate "row already existed"
} = {
  hasDb: true,
  rows: [],
  insertedHashes: [],
  updatedRsns: [],
  conflictOnInsert: false,
};

// Build a tagged-template stub that pattern-matches on the first SQL
// fragment to decide which behaviour to apply.
function sqlTag(strings: TemplateStringsArray, ...vals: unknown[]): unknown {
  const head = strings[0] ?? "";
  if (/INSERT INTO player_claim/i.test(head)) {
    // values = [rsn, hash]; only record the hash if no conflict.
    if (!dbState.conflictOnInsert) {
      dbState.insertedHashes.push(String(vals[1]));
      dbState.rows = [{ token_hash: String(vals[1]) }];
    }
    return Promise.resolve([]);
  }
  if (/SELECT token_hash FROM player_claim/i.test(head)) {
    return Promise.resolve(dbState.rows);
  }
  if (/UPDATE player_claim SET last_used_at/i.test(head)) {
    dbState.updatedRsns.push(String(vals[0]));
    return Promise.resolve([]);
  }
  throw new Error(`Unexpected SQL in test: ${head.slice(0, 80)}`);
}

vi.mock("@/lib/db", () => ({
  sql: () => sqlTag,
  hasDatabase: () => dbState.hasDb,
}));

beforeEach(() => {
  dbState.hasDb = true;
  dbState.rows = [];
  dbState.insertedHashes = [];
  dbState.updatedRsns = [];
  dbState.conflictOnInsert = false;
});

// Lazy-import after the mock is registered.
async function loadAuth() {
  return await import("@/lib/sync-auth");
}

// ---------- extractBearerToken ----------

describe("extractBearerToken", () => {
  it("returns null when header is missing", async () => {
    const { extractBearerToken } = await loadAuth();
    expect(extractBearerToken(null)).toBeNull();
  });

  it("returns null when header is empty string", async () => {
    const { extractBearerToken } = await loadAuth();
    expect(extractBearerToken("")).toBeNull();
  });

  it("returns null when scheme is not Bearer", async () => {
    const { extractBearerToken } = await loadAuth();
    expect(extractBearerToken("Basic abcdef1234567890")).toBeNull();
  });

  it("returns null for a token shorter than 16 chars", async () => {
    const { extractBearerToken } = await loadAuth();
    expect(extractBearerToken("Bearer short")).toBeNull();
  });

  it("returns null for a token longer than 200 chars", async () => {
    const { extractBearerToken } = await loadAuth();
    const tooLong = "a".repeat(201);
    expect(extractBearerToken(`Bearer ${tooLong}`)).toBeNull();
  });

  it("returns null when token contains forbidden characters", async () => {
    const { extractBearerToken } = await loadAuth();
    // space inside token, plus and slash — none in the allowed alphabet.
    expect(extractBearerToken("Bearer abcd efgh1234567890")).toBeNull();
    expect(extractBearerToken("Bearer abcd+efgh1234567890")).toBeNull();
    expect(extractBearerToken("Bearer abcd/efgh1234567890")).toBeNull();
  });

  it("extracts a valid UUID-shaped token", async () => {
    const { extractBearerToken } = await loadAuth();
    const uuid = "11111111-2222-3333-4444-555555555555";
    expect(extractBearerToken(`Bearer ${uuid}`)).toBe(uuid);
  });

  it("accepts the full allowed alphabet [A-Za-z0-9-_.~]", async () => {
    const { extractBearerToken } = await loadAuth();
    const tok = "AZaz09-_.~AZaz09-_.~";
    expect(extractBearerToken(`Bearer ${tok}`)).toBe(tok);
  });
});

// ---------- hashToken (via __test) ----------

describe("hashToken", () => {
  it("is deterministic for the same input", async () => {
    const { __test } = await loadAuth();
    const t = "11111111-2222-3333-4444-555555555555";
    expect(__test.hashToken(t)).toBe(__test.hashToken(t));
  });

  it("produces different hashes for different inputs", async () => {
    const { __test } = await loadAuth();
    const a = __test.hashToken("11111111-2222-3333-4444-555555555555");
    const b = __test.hashToken("11111111-2222-3333-4444-555555555556");
    expect(a).not.toBe(b);
  });

  it("outputs 64 hex chars (SHA-256)", async () => {
    const { __test } = await loadAuth();
    const h = __test.hashToken("anything");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ---------- recordClaim ----------

describe("recordClaim", () => {
  it("returns {ok:false} when DB is not configured", async () => {
    dbState.hasDb = false;
    const { recordClaim } = await loadAuth();
    const r = await recordClaim("Lynx Titan", "11111111-2222-3333-4444-555555555555");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/database/i);
  });

  it("returns {ok:false} for empty RSN", async () => {
    const { recordClaim } = await loadAuth();
    const r = await recordClaim("   ", "11111111-2222-3333-4444-555555555555");
    expect(r.ok).toBe(false);
  });

  it("records a fresh claim and reports ok", async () => {
    const { recordClaim, __test } = await loadAuth();
    const token = "11111111-2222-3333-4444-555555555555";
    const r = await recordClaim("Lynx Titan", token);
    expect(r.ok).toBe(true);
    expect(dbState.insertedHashes).toEqual([__test.hashToken(token)]);
  });

  it("reports whether an RSN already has a claim", async () => {
    const { recordClaim, hasExistingClaim } = await loadAuth();
    expect(await hasExistingClaim("Claimed One")).toBe(false);
    await recordClaim("Claimed One", "token-abcdefghijklmnop");
    expect(await hasExistingClaim("claimed one")).toBe(true);
  });

  it("treats a re-claim with the SAME token as ok (idempotent)", async () => {
    const { recordClaim, __test } = await loadAuth();
    const token = "11111111-2222-3333-4444-555555555555";
    // First call inserts.
    await recordClaim("Lynx Titan", token);
    // Second call: row already exists with the same hash.
    dbState.conflictOnInsert = true;
    dbState.rows = [{ token_hash: __test.hashToken(token) }];
    const r = await recordClaim("Lynx Titan", token);
    expect(r.ok).toBe(true);
  });

  it("rejects a re-claim with a DIFFERENT token", async () => {
    const { recordClaim, __test } = await loadAuth();
    const original = "11111111-2222-3333-4444-555555555555";
    const attacker = "99999999-2222-3333-4444-555555555555";
    // Pretend the existing row is for the original token.
    dbState.conflictOnInsert = true;
    dbState.rows = [{ token_hash: __test.hashToken(original) }];
    const r = await recordClaim("Lynx Titan", attacker);
    expect(r.ok).toBe(false);
    expect(r.existingTokenHash).toBe(__test.hashToken(original));
  });

  it("normalizes the RSN (case-insensitive, trimmed, 12-char cap)", async () => {
    const { recordClaim, __test } = await loadAuth();
    const token = "11111111-2222-3333-4444-555555555555";
    // First call with "  LYNX TITAN  ".
    await recordClaim("  LYNX TITAN  ", token);
    // Now re-claim with the same token but different case — must be idempotent.
    dbState.conflictOnInsert = true;
    dbState.rows = [{ token_hash: __test.hashToken(token) }];
    const r = await recordClaim("lynx titan", token);
    expect(r.ok).toBe(true);
  });
});

// ---------- verifyClaim ----------

describe("verifyClaim", () => {
  it("returns false when DB is not configured", async () => {
    dbState.hasDb = false;
    const { verifyClaim } = await loadAuth();
    expect(await verifyClaim("Lynx Titan", "11111111-2222-3333-4444-555555555555")).toBe(false);
  });

  it("returns false when no claim row exists for the RSN", async () => {
    const { verifyClaim } = await loadAuth();
    dbState.rows = [];
    expect(await verifyClaim("Lynx Titan", "11111111-2222-3333-4444-555555555555")).toBe(false);
  });

  it("returns false when the stored hash does not match the token", async () => {
    const { verifyClaim, __test } = await loadAuth();
    dbState.rows = [{ token_hash: __test.hashToken("other-token-other-token") }];
    expect(await verifyClaim("Lynx Titan", "11111111-2222-3333-4444-555555555555")).toBe(false);
  });

  it("returns true and touches last_used_at on a match", async () => {
    const { verifyClaim, __test } = await loadAuth();
    const token = "11111111-2222-3333-4444-555555555555";
    dbState.rows = [{ token_hash: __test.hashToken(token) }];
    expect(await verifyClaim("Lynx Titan", token)).toBe(true);
    expect(dbState.updatedRsns).toContain("lynx titan");
  });

  it("normalizes RSN before lookup (case-insensitive)", async () => {
    const { verifyClaim, __test } = await loadAuth();
    const token = "11111111-2222-3333-4444-555555555555";
    dbState.rows = [{ token_hash: __test.hashToken(token) }];
    expect(await verifyClaim("LYNX TITAN", token)).toBe(true);
  });
});

// ---------- generateInstallToken ----------

describe("generateInstallToken", () => {
  it("returns a UUID-shaped string", async () => {
    const { generateInstallToken } = await loadAuth();
    const t = generateInstallToken();
    expect(t).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("does not collide across many calls", async () => {
    const { generateInstallToken } = await loadAuth();
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(generateInstallToken());
    expect(set.size).toBe(1000);
  });
});
