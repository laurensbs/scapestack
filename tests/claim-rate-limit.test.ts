import { describe, it, expect, beforeEach, vi } from "vitest";

// Counts the module would see from the database, driven per test.
const dbState: {
  hasDb: boolean;
  tokenHourly: number;
  ipHourly: number;
  inserts: Array<{ ipHash: string; tokenHash: string }>;
  pruned: number;
  throwOnQuery: boolean;
} = {
  hasDb: true,
  tokenHourly: 0,
  ipHourly: 0,
  inserts: [],
  pruned: 0,
  throwOnQuery: false
};

function sqlTag(strings: TemplateStringsArray, ...vals: unknown[]): unknown {
  const flat = strings.join(" ").replace(/\s+/g, " ").trim();
  if (dbState.throwOnQuery) throw new Error("neon is having a day");
  if (/DELETE FROM claim_attempt/i.test(flat)) {
    dbState.pruned += 1;
    return Promise.resolve([]);
  }
  if (/INSERT INTO claim_attempt/i.test(flat)) {
    dbState.inserts.push({ ipHash: String(vals[0]), tokenHash: String(vals[1]) });
    return Promise.resolve([]);
  }
  if (/COUNT\(\*\) FILTER/i.test(flat)) {
    return Promise.resolve([{ token_hourly: dbState.tokenHourly, ip_hourly: dbState.ipHourly }]);
  }
  throw new Error(`Unexpected SQL in test: ${flat.slice(0, 80)}`);
}

vi.mock("@/lib/db", () => ({
  sql: () => sqlTag,
  hasDatabase: () => dbState.hasDb
}));

beforeEach(() => {
  dbState.hasDb = true;
  dbState.tokenHourly = 0;
  dbState.ipHourly = 0;
  dbState.inserts = [];
  dbState.pruned = 0;
  dbState.throwOnQuery = false;
});

async function load() {
  return await import("@/lib/claim-rate-limit");
}

const TOKEN = "11111111-2222-3333-4444-555555555555";

describe("claim rate limiting", () => {
  it("lets a normal setup through", async () => {
    // A player's install claims their main, maybe an ironman, maybe an alt.
    const { checkAndRecordClaimAttempt } = await load();
    dbState.tokenHourly = 3;
    dbState.ipHourly = 4;

    expect(await checkAndRecordClaimAttempt({ address: "1.2.3.4", token: TOKEN }))
      .toEqual({ allowed: true });
  });

  it("stops one install from walking the Hiscores", async () => {
    const { checkAndRecordClaimAttempt, CLAIM_LIMITS } = await load();
    dbState.tokenHourly = CLAIM_LIMITS.perTokenHourly;

    expect(await checkAndRecordClaimAttempt({ address: "1.2.3.4", token: TOKEN }))
      .toEqual({ allowed: false, scope: "token" });
  });

  it("stops one address rotating tokens to get around that", async () => {
    const { checkAndRecordClaimAttempt, CLAIM_LIMITS } = await load();
    dbState.ipHourly = CLAIM_LIMITS.perIpHourly;

    expect(await checkAndRecordClaimAttempt({ address: "1.2.3.4", token: TOKEN }))
      .toEqual({ allowed: false, scope: "ip" });
  });

  it("counts the attempt whether or not the claim succeeds", async () => {
    // An enumerating attacker generates mostly failures, so only counting
    // successful claims would miss the behaviour worth limiting.
    const { checkAndRecordClaimAttempt } = await load();
    await checkAndRecordClaimAttempt({ address: "1.2.3.4", token: TOKEN });
    expect(dbState.inserts.length).toBe(1);
  });

  it("stores a hash of the address, never the address", async () => {
    const { checkAndRecordClaimAttempt } = await load();
    await checkAndRecordClaimAttempt({ address: "203.0.113.7", token: TOKEN });

    const [row] = dbState.inserts;
    expect(row.ipHash).not.toContain("203.0.113.7");
    expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.tokenHash).not.toContain(TOKEN);
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("prunes old rows on write so the table cannot grow forever", async () => {
    const { checkAndRecordClaimAttempt } = await load();
    await checkAndRecordClaimAttempt({ address: "1.2.3.4", token: TOKEN });
    expect(dbState.pruned).toBe(1);
  });

  it("fails open, because a database hiccup must not block plugin setup", async () => {
    const { checkAndRecordClaimAttempt } = await load();
    dbState.throwOnQuery = true;

    expect(await checkAndRecordClaimAttempt({ address: "1.2.3.4", token: TOKEN }))
      .toEqual({ allowed: true });
  });

  it("is inert without a database, so local dev still works", async () => {
    const { checkAndRecordClaimAttempt } = await load();
    dbState.hasDb = false;

    expect(await checkAndRecordClaimAttempt({ address: "1.2.3.4", token: TOKEN }))
      .toEqual({ allowed: true });
    expect(dbState.inserts).toEqual([]);
  });
});

describe("client address", () => {
  it("takes the left-most x-forwarded-for entry", async () => {
    const { clientAddressFrom } = await load();
    const request = new Request("https://example.test", {
      headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" }
    });
    expect(clientAddressFrom(request)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip and then to a constant", async () => {
    const { clientAddressFrom } = await load();
    expect(clientAddressFrom(new Request("https://example.test", {
      headers: { "x-real-ip": "203.0.113.9" }
    }))).toBe("203.0.113.9");
    expect(clientAddressFrom(new Request("https://example.test"))).toBe("unknown");
  });
});
