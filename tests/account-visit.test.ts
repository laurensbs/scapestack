import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

const state = {
  queries: [] as Array<{ sql: string; params: unknown[] }>,
  rows: [] as Record<string, unknown>[][]
};

vi.mock("@/lib/db", () => ({
  hasDatabase: () => true,
  sql: () => ({
    query: async (sql: string, params: unknown[] = []) => {
      state.queries.push({ sql, params });
      return state.rows.shift() ?? [];
    }
  })
}));

vi.mock("@/lib/sync-repo", () => ({ ensureSyncSchema: async () => undefined }));

const {
  recordVisitForKnownAccount,
  registerAccountVisit,
  returnRate,
  returnRates
} = await import("@/lib/account-visit-repo");

beforeEach(() => {
  state.queries = [];
  state.rows = [];
});

describe("registering a visit", () => {
  it("creates the identity an RSN-only player never had", async () => {
    // account_identity was only ever written by a plugin sync or a claim, and
    // the daily cron iterates that table. Without this, the backbone built
    // specifically for RSN-only players had no RSN-only player in it.
    state.rows = [[{ account_id: "acc-1", created: true }], []];
    const visit = await registerAccountVisit({ rsn: "Lauky", displayName: "Lauky" });
    expect(visit).toEqual({ accountId: "acc-1", registered: true });
    expect(state.queries[0].sql).toContain("INSERT INTO account_identity");
    expect(state.queries[0].params[0]).toBe("lauky");
  });

  it("records one row per day, not one per page view", async () => {
    state.rows = [[{ account_id: "acc-1", created: false }], []];
    await registerAccountVisit({ rsn: "lauky", displayName: "Lauky" });
    expect(state.queries[1].sql).toContain("INSERT INTO account_visit");
    expect(state.queries[1].sql).toContain("CURRENT_DATE");
    // Reloading twenty times must not read as twenty returning players.
    expect(state.queries[1].sql).toContain("ON CONFLICT DO NOTHING");
  });

  it("will not resurrect an account that asked to be deleted", async () => {
    // The player's own browser reloading the page it was on must not quietly
    // undo "delete my data".
    state.rows = [[{ account_id: "acc-1", created: false }], []];
    await registerAccountVisit({ rsn: "lauky", displayName: "Lauky" });
    expect(state.queries[1].sql).toContain("deletion_requested_at IS NULL");
  });

  it("does not overwrite a display name with an empty string", async () => {
    state.rows = [[{ account_id: "acc-1", created: true }], []];
    await registerAccountVisit({ rsn: "lauky", displayName: "" });
    expect(state.queries[0].params[1]).toBe("lauky");
  });
});

describe("a visit from a player already in the roster", () => {
  it("reports a miss so the caller knows it still has to verify", async () => {
    state.rows = [[]];
    expect(await recordVisitForKnownAccount("stranger")).toBeNull();
  });

  it("records the visit without a second hiscores check", async () => {
    state.rows = [[{ account_id: "acc-1" }], []];
    expect(await recordVisitForKnownAccount("Lauky")).toEqual({ accountId: "acc-1", registered: false });
    expect(state.queries[0].params[0]).toBe("lauky");
    expect(state.queries[1].sql).toContain("INSERT INTO account_visit");
  });

  it("treats an account pending deletion as a miss, not as a visit", async () => {
    // The UPDATE filters on deletion_requested_at, so a pending-deletion
    // account returns no row and never reaches the visit insert.
    state.rows = [[]];
    await recordVisitForKnownAccount("lauky");
    expect(state.queries[0].sql).toContain("deletion_requested_at IS NULL");
    expect(state.queries).toHaveLength(1);
  });
});

describe("D1/D7 return (§7)", () => {
  it("maps the four counts the metric is built from", async () => {
    state.rows = [[{ d1_cohort: 100, d1_returned: 31, d7_cohort: 40, d7_returned: 6 }]];
    expect(await returnRates()).toEqual({
      d1Cohort: 100, d1Returned: 31, d7Cohort: 40, d7Returned: 6
    });
  });

  it("counts D1 and D7 over different cohorts", async () => {
    // An account created yesterday cannot yet have a day-7 answer. Counting it
    // in the D7 denominator reports a return rate LOWER than the truth — the
    // direction a metric is least likely to be questioned in.
    state.rows = [[{}]];
    await returnRates();
    const sql = state.queries[0].sql;
    expect(sql).toContain("day_zero <= CURRENT_DATE - 2");
    expect(sql).toContain("day_zero <= CURRENT_DATE - 8");
  });

  it("asks whether they came back on day N, not on day N or later", async () => {
    // "Day N or later" is cumulative retention. It only ever goes up with
    // time, and reading it as D7 flatters the product every week.
    state.rows = [[{}]];
    await returnRates();
    const sql = state.queries[0].sql;
    expect(sql).toContain("v.visit_date = day_zero + 1");
    expect(sql).toContain("v.visit_date = day_zero + 7");
    expect(sql).not.toMatch(/visit_date\s*>=\s*day_zero/);
  });

  it("excludes accounts that asked to be deleted", async () => {
    state.rows = [[{}]];
    await returnRates();
    expect(state.queries[0].sql).toContain("deletion_requested_at IS NULL");
  });

  it("reports an empty cohort as unknown, not as nobody coming back", async () => {
    // "0% D7 return" printed under a cohort of zero has started more than one
    // wrong conversation.
    expect(returnRate(0, 0)).toBeNull();
    expect(returnRate(0, 10)).toBe(0);
    expect(returnRate(31, 100)).toBe(31);
    expect(returnRate(1, 3)).toBe(33.3);
  });
});

describe("the visit ledger is account data, and delete-my-data takes it", () => {
  const schema = read("src/lib/sync-schema.ts");

  it("cascades from the identity", () => {
    const start = schema.indexOf("CREATE TABLE IF NOT EXISTS account_visit (");
    expect(start).toBeGreaterThan(-1);
    const body = schema.slice(start, schema.indexOf(");", start));
    expect(body).toContain("REFERENCES account_identity(account_id) ON DELETE CASCADE");
  });

  it("holds a date and an account, and nothing that identifies a device", () => {
    const start = schema.indexOf("CREATE TABLE IF NOT EXISTS account_visit (");
    const body = schema.slice(start, schema.indexOf(");", start));
    expect(body).not.toMatch(/ip|address|user_agent|referrer|path|session/i);
  });

  it("keeps only hashes in the rate counter, never the name or the address", () => {
    const start = schema.indexOf("CREATE TABLE IF NOT EXISTS rate_attempt (");
    expect(start).toBeGreaterThan(-1);
    const body = schema.slice(start, schema.indexOf(");", start));
    expect(body).toContain("key_hash TEXT NOT NULL");
    expect(body).not.toMatch(/\brsn\b|ip_address|\bemail\b/i);
    expect(read("src/lib/rate-attempt.ts")).toContain('createHash("sha256")');
  });

  it("seeds a day-zero visit for every account that predates the ledger", () => {
    // Without it, every existing account joins the D1/D7 denominator as a
    // cohort member who never visited at all.
    expect(schema).toContain("INSERT INTO account_visit (account_id, visit_date)");
    expect(schema).toContain("SELECT account_id, last_seen_at::date FROM account_identity");
  });
});
