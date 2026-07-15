import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  claimed: true,
  pairingStatus: "pending",
  pairingApproved: true,
  recentPairings: 0,
  completeConnected: false,
  sessionConnected: true,
  queries: [] as Array<{ query: string; params: unknown[] }>,
  query: vi.fn(async (query: string, params: unknown[] = []) => {
    database.queries.push({ query, params });
    if (query.includes("JOIN player_claim claim")) return database.claimed ? [{ account_id: "account-1", recent_pairings: database.recentPairings }] : [];
    if (query.includes("DELETE FROM account_pairing")) return [];
    if (query.includes("INSERT INTO account_pairing")) return [];
    if (query.includes("UPDATE account_pairing pairing")) return database.pairingApproved ? [{ pairing_id: "pair-1" }] : [];
    if (query.includes("WITH consumed AS")) return database.completeConnected ? [{
      account_id: "account-1", rsn: "lynx titan", display_name: "Lynx Titan", last_seen_at: "2026-07-15T12:00:00.000Z"
    }] : [];
    if (query.includes("SELECT status, expires_at")) return [{
      status: database.pairingStatus,
      expires_at: database.pairingStatus === "expired" ? "2026-07-15T11:00:00.000Z" : "2026-07-15T12:10:00.000Z"
    }];
    if (query.includes("WITH active AS")) return database.sessionConnected ? [{
      account_id: "account-1", rsn: "lynx titan", display_name: "Lynx Titan", last_seen_at: "2026-07-15T12:00:00.000Z"
    }] : [];
    if (query.includes("UPDATE account_browser_session")) return [];
    return [];
  })
}));

vi.mock("@/lib/db", () => ({ sql: () => ({ query: database.query }) }));
vi.mock("@/lib/sync-repo", () => ({ ensureSyncSchema: async () => undefined }));

import {
  approveAccountPairing,
  completeAccountPairing,
  getConnectedAccount,
  hashAccountSecret,
  revokeBrowserSession,
  startAccountPairing
} from "@/lib/account-pairing";

beforeEach(() => {
  database.claimed = true;
  database.pairingStatus = "pending";
  database.pairingApproved = true;
  database.recentPairings = 0;
  database.completeConnected = false;
  database.sessionConnected = true;
  database.queries = [];
  database.query.mockClear();
});

describe("account pairing repository", () => {
  it("creates a short-lived pairing only for a plugin-claimed identity", async () => {
    const now = new Date("2026-07-15T12:00:00.000Z");
    const pairing = await startAccountPairing("Lynx Titan", now);
    expect(pairing).toMatchObject({ status: "created", expiresAt: "2026-07-15T12:10:00.000Z" });
    if (pairing.status !== "created") throw new Error("expected pairing");
    const insert = database.queries.find((entry) => entry.query.includes("INSERT INTO account_pairing"));
    expect(insert?.params[3]).toBe(hashAccountSecret(pairing.code.replace("-", "")));
    expect(insert?.params[4]).toBe(hashAccountSecret(pairing.browserSecret));
    expect(JSON.stringify(insert?.params)).not.toContain(pairing.browserSecret);

    database.claimed = false;
    await expect(startAccountPairing("Unclaimed", now)).resolves.toEqual({ status: "unclaimed" });

    database.claimed = true;
    database.recentPairings = 5;
    await expect(startAccountPairing("Lynx Titan", now)).resolves.toEqual({ status: "rate-limited" });
  });

  it("approves only a live code scoped to the same normalized RSN", async () => {
    await expect(approveAccountPairing(" LYNX   TITAN ", "abcd-efgh", new Date("2026-07-15T12:00:00.000Z")))
      .resolves.toBe("approved");
    const update = database.queries.find((entry) => entry.query.includes("UPDATE account_pairing pairing"));
    expect(update?.params[0]).toBe("lynx titan");
    expect(update?.params[1]).toBe(hashAccountSecret("ABCDEFGH"));
  });

  it("does not mint a browser session until RuneLite approved the pairing", async () => {
    const pending = await completeAccountPairing("11111111-2222-4333-8444-555555555555", "browser-secret", new Date("2026-07-15T12:00:00.000Z"));
    expect(pending).toEqual({ status: "pending" });

    database.completeConnected = true;
    const connected = await completeAccountPairing("11111111-2222-4333-8444-555555555555", "browser-secret", new Date("2026-07-15T12:00:00.000Z"));
    expect(connected).toMatchObject({
      status: "connected",
      expiresAt: "2026-08-14T12:00:00.000Z",
      account: { accountId: "account-1", displayName: "Lynx Titan" }
    });
    if (connected.status !== "connected") throw new Error("expected session");
    const persistence = database.queries.filter((entry) => entry.query.includes("WITH consumed AS")).at(-1);
    expect(JSON.stringify(persistence?.params)).not.toContain(connected.sessionToken);
    expect(persistence?.params[3]).toBe(hashAccountSecret(connected.sessionToken));
  });

  it("loads and revokes only the presented browser session", async () => {
    await expect(getConnectedAccount("browser-session", new Date("2026-07-15T12:00:00.000Z")))
      .resolves.toMatchObject({ accountId: "account-1", displayName: "Lynx Titan" });
    await revokeBrowserSession("browser-session", new Date("2026-07-15T12:01:00.000Z"));
    const revoke = database.queries.find((entry) => entry.query.includes("UPDATE account_browser_session"));
    expect(revoke?.params[0]).toBe(hashAccountSecret("browser-session"));
  });
});
