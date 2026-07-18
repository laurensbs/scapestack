import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  account: null as null | { accountId: string; rsn: string; displayName: string; lastSeenAt: string },
  page: { moments: [] as Array<Record<string, unknown>>, nextCursor: null as string | null, recap: null as null | Record<string, unknown> },
  imported: { imported: 0, ignored: 0 },
  importError: null as Error | null,
  timelineCalls: 0,
  timelineInput: null as null | { accountId: string; options: Record<string, unknown> },
  timelineError: null as Error | null,
  importInput: null as unknown
}));

vi.mock("@/lib/account-pairing", () => ({
  getConnectedAccount: async () => state.account
}));
vi.mock("@/lib/account-timeline-repo", () => ({
  validTimelineCursor: (value: string | null) => !value || value === "valid-cursor",
  getAccountTimeline: async (accountId: string, options: Record<string, unknown>) => {
    state.timelineCalls += 1;
    state.timelineInput = { accountId, options };
    if (state.timelineError) throw state.timelineError;
    return state.page;
  },
  importLegacyTripEvents: async (_accountId: string, _rsn: string, input: unknown) => {
    state.importInput = input;
    if (state.importError) throw state.importError;
    return state.imported;
  }
}));

beforeEach(() => {
  state.account = null;
  state.page = { moments: [], nextCursor: null, recap: null };
  state.imported = { imported: 0, ignored: 0 };
  state.importError = null;
  state.timelineCalls = 0;
  state.timelineInput = null;
  state.timelineError = null;
  state.importInput = null;
});

describe("account timeline API", () => {
  it("does not expose history without a connected browser session", async () => {
    const { GET } = await import("@/app/api/account/timeline/route");
    const response = await GET(new Request("http://local/api/account/timeline"));
    expect(response.status).toBe(401);
    expect(state.timelineCalls).toBe(0);
  });

  it("returns no placeholder cards for an empty connected account", async () => {
    state.account = connectedAccount();
    const { GET } = await import("@/app/api/account/timeline/route");
    const response = await GET(new Request("http://local/api/account/timeline", { headers: { cookie: "scapestack_account=session" } }));
    await expect(response.json()).resolves.toMatchObject({ ok: true, moments: [], nextCursor: null, recap: null, account: { rsn: "lauky" } });
    expect(state.timelineInput).toMatchObject({ accountId: "account-1", options: { accountRsn: "lauky" } });
  });

  it("returns a partial or returning page without inventing missing moments", async () => {
    state.account = connectedAccount();
    state.page = {
      moments: [{ id: "snapshot:4", kind: "xp", occurredAt: "2026-07-16T10:00:00Z", title: "Gained 180k Slayer XP" }],
      nextCursor: "valid-cursor",
      recap: { title: "Levels moved since last time", nextAction: "Replan from new levels" }
    };
    const { GET } = await import("@/app/api/account/timeline/route");
    const response = await GET(new Request("http://local/api/account/timeline?limit=1", { headers: { cookie: "scapestack_account=session" } }));
    await expect(response.json()).resolves.toMatchObject({
      moments: [{ title: "Gained 180k Slayer XP" }],
      nextCursor: "valid-cursor",
      recap: { title: "Levels moved since last time", nextAction: "Replan from new levels" }
    });
  });

  it("returns a player-safe JSON error when the timeline cannot load", async () => {
    state.account = connectedAccount();
    state.timelineError = new Error("private database detail");
    const { GET } = await import("@/app/api/account/timeline/route");
    const response = await GET(new Request("http://local/api/account/timeline", { headers: { cookie: "scapestack_account=session" } }));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "Could not load your recent progress" });
  });

  it("rejects a broken cursor and accepts legacy migration for the connected account", async () => {
    state.account = connectedAccount();
    const { GET, POST } = await import("@/app/api/account/timeline/route");
    expect((await GET(new Request("http://local/api/account/timeline?cursor=broken", { headers: { cookie: "scapestack_account=session" } }))).status).toBe(400);

    state.imported = { imported: 1, ignored: 1 };
    const events = [{ version: 1, id: "boss:vorkath" }];
    const imported = await POST(new Request("http://local/api/account/timeline", {
      method: "POST",
      headers: { cookie: "scapestack_account=session", "content-type": "application/json" },
      body: JSON.stringify({ events })
    }));
    expect(imported.status).toBe(200);
    expect(state.importInput).toEqual(events);
  });

  it("returns a player-safe JSON error when legacy migration fails", async () => {
    state.account = connectedAccount();
    state.importError = new Error("database detail that must not reach the browser");
    const { POST } = await import("@/app/api/account/timeline/route");
    const response = await POST(new Request("http://local/api/account/timeline", {
      method: "POST",
      headers: { cookie: "scapestack_account=session", "content-type": "application/json" },
      body: JSON.stringify({ events: [] })
    }));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "Could not save those trips" });
  });
});

function connectedAccount() {
  return { accountId: "account-1", rsn: "lauky", displayName: "Lauky", lastSeenAt: "2026-07-16T10:00:00Z" };
}
