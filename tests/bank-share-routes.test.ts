import { beforeEach, describe, expect, it, vi } from "vitest";

const shareId = "AbCdEfGhIjKlMnOpQrStUvWx";
const state = vi.hoisted(() => ({
  account: null as null | { accountId: string; rsn: string; displayName: string; lastSeenAt: string },
  created: [] as Array<Record<string, unknown>>,
  published: [] as Array<{ accountId: string; shareId: string }>,
  unpublished: [] as Array<{ accountId: string; shareId: string }>
}));

vi.mock("@/lib/account-pairing", () => ({
  getConnectedAccount: async () => state.account
}));

vi.mock("@/lib/bank-share-repo", () => ({
  createPrivateBankShare: async (account: Record<string, unknown>) => {
    state.created.push(account);
    return {
      status: "created",
      shareId,
      snapshot: { version: 1, displayName: "Lauky", gp: 42, rows: [] }
    };
  },
  publishBankShare: async (accountId: string, id: string) => {
    state.published.push({ accountId, shareId: id });
    return id === shareId ? { shareId: id, publicPath: `/share/bank/${id}` } : null;
  },
  unpublishBankShare: async (accountId: string, id: string) => {
    state.unpublished.push({ accountId, shareId: id });
    return id === shareId;
  }
}));

beforeEach(() => {
  state.account = null;
  state.created = [];
  state.published = [];
  state.unpublished = [];
  vi.resetModules();
});

function connected() {
  state.account = {
    accountId: "account-1",
    rsn: "lauky",
    displayName: "Lauky",
    lastSeenAt: "2026-07-30T10:00:00.000Z"
  };
}

function request(method: "POST" | "PATCH" | "DELETE", body: unknown = {}, origin?: string): Request {
  return new Request("https://www.scapestack.org/api/account/bank-share", {
    method,
    headers: {
      host: "www.scapestack.org",
      cookie: "scapestack_account=session-token",
      "content-type": "application/json",
      ...(origin ? { origin } : {})
    },
    body: JSON.stringify(body)
  });
}

describe("owner bank share API", () => {
  it("creates only a private snapshot for a connected owner", async () => {
    const { POST } = await import("@/app/api/account/bank-share/route");
    expect((await POST(request("POST"))).status).toBe(401);
    expect(state.created).toEqual([]);

    connected();
    const response = await POST(request("POST"));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, share: { shareId, state: "private" } });
    expect(body.share).not.toHaveProperty("publicPath");
    expect(state.created).toHaveLength(1);
  });

  it("publishes only after an explicit owner opt-in and can revoke it", async () => {
    connected();
    const { PATCH, DELETE } = await import("@/app/api/account/bank-share/route");

    const implicit = await PATCH(request("PATCH", { shareId }));
    expect(implicit.status).toBe(400);
    expect(state.published).toEqual([]);

    const published = await PATCH(request("PATCH", { shareId, publish: true }));
    expect(published.status).toBe(200);
    await expect(published.json()).resolves.toMatchObject({
      share: { shareId, state: "public", publicPath: `/share/bank/${shareId}` }
    });
    expect(state.published).toEqual([{ accountId: "account-1", shareId }]);

    const revoked = await DELETE(request("DELETE", { shareId }));
    expect(revoked.status).toBe(200);
    expect(state.unpublished).toEqual([{ accountId: "account-1", shareId }]);
  });

  it("rejects cross-origin publication before touching owner data", async () => {
    connected();
    const { PATCH } = await import("@/app/api/account/bank-share/route");
    const response = await PATCH(request("PATCH", { shareId, publish: true }, "https://evil.example"));
    expect(response.status).toBe(403);
    expect(state.published).toEqual([]);
  });
});
