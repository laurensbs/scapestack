import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  connectedAccount: null as null | { accountId: string; rsn: string; displayName: string; lastSeenAt: string },
  deletedRsns: [] as string[],
  revoked: [] as string[]
}));

vi.mock("@/lib/account-pairing", () => ({
  getConnectedAccount: async () => state.connectedAccount,
  revokeBrowserSession: async (token: string) => { state.revoked.push(token); }
}));

vi.mock("@/lib/account-history-repo", () => ({
  deleteAccountHistory: async (rsn: string) => {
    state.deletedRsns.push(rsn);
    return true;
  }
}));

function request(headers: HeadersInit = {}): Request {
  return new Request("https://www.scapestack.org/api/account/delete?rsn=someone-else", {
    method: "DELETE",
    headers: {
      host: "www.scapestack.org",
      cookie: "scapestack_account=session-token",
      ...headers
    }
  });
}

beforeEach(() => {
  state.connectedAccount = null;
  state.deletedRsns = [];
  state.revoked = [];
  vi.resetModules();
});

describe("DELETE /api/account/delete", () => {
  it("rejects account deletion without a connected browser session", async () => {
    const { DELETE } = await import("@/app/api/account/delete/route");
    const response = await DELETE(request({ cookie: "" }));

    expect(response.status).toBe(401);
    expect(state.deletedRsns).toEqual([]);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Connect RuneLite before deleting account history"
    });
  });

  it("deletes only the connected account and clears the browser session", async () => {
    state.connectedAccount = {
      accountId: "account-1",
      rsn: "lauky",
      displayName: "Lauky",
      lastSeenAt: "2026-07-18T10:00:00.000Z"
    };
    const { DELETE } = await import("@/app/api/account/delete/route");
    const response = await DELETE(request());

    expect(response.status).toBe(200);
    expect(state.deletedRsns).toEqual(["lauky"]);
    expect(state.revoked).toEqual(["session-token"]);
    expect(response.headers.get("set-cookie")).toContain("scapestack_account=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      deleted: true,
      account: { rsn: "lauky", displayName: "Lauky" }
    });
  });

  it("rejects cross-origin browser deletion attempts", async () => {
    state.connectedAccount = {
      accountId: "account-1",
      rsn: "lauky",
      displayName: "Lauky",
      lastSeenAt: "2026-07-18T10:00:00.000Z"
    };
    const { DELETE } = await import("@/app/api/account/delete/route");
    const response = await DELETE(request({ origin: "https://evil.example" }));

    expect(response.status).toBe(403);
    expect(state.deletedRsns).toEqual([]);
    expect(state.revoked).toEqual([]);
  });

  it("allows same-origin browser deletion", async () => {
    state.connectedAccount = {
      accountId: "account-1",
      rsn: "lauky",
      displayName: "Lauky",
      lastSeenAt: "2026-07-18T10:00:00.000Z"
    };
    const { DELETE } = await import("@/app/api/account/delete/route");
    const response = await DELETE(request({ origin: "https://www.scapestack.org" }));

    expect(response.status).toBe(200);
    expect(state.deletedRsns).toEqual(["lauky"]);
  });
});
