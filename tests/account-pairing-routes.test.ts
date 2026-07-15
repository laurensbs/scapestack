import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  pairing: { status: "created", pairingId: "11111111-2222-4333-8444-555555555555", code: "ABCD-EFGH", browserSecret: "browser-secret", expiresAt: "2026-07-15T12:10:00.000Z" } as Record<string, unknown>,
  approved: "approved" as "approved" | "not-found",
  verified: true,
  completed: { status: "pending" } as Record<string, unknown>,
  connectedAccount: null as Record<string, unknown> | null,
  revoked: [] as string[]
}));

vi.mock("@/lib/account-pairing", () => ({
  startAccountPairing: async () => state.pairing,
  approveAccountPairing: async () => state.approved,
  completeAccountPairing: async () => state.completed,
  getConnectedAccount: async () => state.connectedAccount,
  revokeBrowserSession: async (token: string) => { state.revoked.push(token); }
}));

vi.mock("@/lib/sync-auth", () => ({
  extractBearerToken: (header: string | null) => header?.startsWith("Bearer ") ? header.slice(7) : null,
  verifyClaim: async () => state.verified
}));

beforeEach(() => {
  state.pairing = { status: "created", pairingId: "11111111-2222-4333-8444-555555555555", code: "ABCD-EFGH", browserSecret: "browser-secret", expiresAt: "2026-07-15T12:10:00.000Z" };
  state.approved = "approved";
  state.verified = true;
  state.completed = { status: "pending" };
  state.connectedAccount = null;
  state.revoked = [];
});

describe("progressive account pairing routes", () => {
  it("starts from an RSN without creating a password account", async () => {
    const { POST } = await import("@/app/api/account/pair/start/route");
    const response = await POST(new Request("http://local/api/account/pair/start", {
      method: "POST",
      body: JSON.stringify({ rsn: "Lynx Titan" })
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      pairing: { code: "ABCD-EFGH", browserSecret: "browser-secret" }
    });
  });

  it("returns a retryable response when pairing starts are rate limited", async () => {
    const { POST } = await import("@/app/api/account/pair/start/route");
    state.pairing = { status: "rate-limited" };
    const response = await POST(new Request("http://local/api/account/pair/start", {
      method: "POST",
      body: JSON.stringify({ rsn: "Lynx Titan" })
    }));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Wait a minute before creating another code"
    });
  });

  it("requires the matching RuneLite claim to approve a browser", async () => {
    const { POST } = await import("@/app/api/account/pair/approve/route");
    state.verified = false;
    const denied = await POST(new Request("http://local/api/account/pair/approve", {
      method: "POST",
      headers: { authorization: "Bearer plugin-token", "content-type": "application/json" },
      body: JSON.stringify({ rsn: "Lynx Titan", code: "ABCD-EFGH" })
    }));
    expect(denied.status).toBe(403);

    state.verified = true;
    const approved = await POST(new Request("http://local/api/account/pair/approve", {
      method: "POST",
      headers: { authorization: "Bearer plugin-token", "content-type": "application/json" },
      body: JSON.stringify({ rsn: "Lynx Titan", code: "ABCD-EFGH" })
    }));
    expect(approved.status).toBe(200);
  });

  it("keeps polling pending and sets an HttpOnly session only after approval", async () => {
    const { POST } = await import("@/app/api/account/pair/complete/route");
    const request = () => new Request("http://local/api/account/pair/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pairingId: "11111111-2222-4333-8444-555555555555", browserSecret: "browser-secret" })
    });
    const pending = await POST(request());
    expect(pending.status).toBe(202);
    expect(pending.headers.get("set-cookie")).toBeNull();

    state.completed = {
      status: "connected",
      sessionToken: "raw-browser-session",
      expiresAt: "2026-08-14T12:00:00.000Z",
      account: { accountId: "account-1", rsn: "lynx titan", displayName: "Lynx Titan", lastSeenAt: "2026-07-15T12:00:00.000Z" }
    };
    const connected = await POST(request());
    expect(connected.status).toBe(200);
    expect(connected.headers.get("set-cookie")).toContain("scapestack_account=raw-browser-session");
    expect(connected.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("loads and revokes the connected browser without deleting account history", async () => {
    const { GET, DELETE } = await import("@/app/api/account/me/route");
    state.connectedAccount = { accountId: "account-1", rsn: "lynx titan", displayName: "Lynx Titan", lastSeenAt: "2026-07-15T12:00:00.000Z" };
    const request = new Request("http://local/api/account/me", {
      headers: { cookie: "other=x; scapestack_account=session-token" }
    });
    const loaded = await GET(request);
    await expect(loaded.json()).resolves.toMatchObject({ connected: true, account: { displayName: "Lynx Titan" } });

    const removed = await DELETE(request);
    expect(state.revoked).toEqual(["session-token"]);
    expect(removed.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
