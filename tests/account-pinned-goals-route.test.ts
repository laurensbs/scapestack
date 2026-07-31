import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinnedGoal, type PinnedGoal } from "@/lib/pinned-goals";

const state = vi.hoisted(() => ({
  account: null as null | { accountId: string; rsn: string; displayName: string; lastSeenAt: string },
  goals: [] as PinnedGoal[],
  writes: [] as Array<{ accountId: string; goal: unknown }>,
  deletes: [] as Array<{ accountId: string; key: string }>
}));

vi.mock("@/lib/account-pairing", () => ({ getConnectedAccount: async () => state.account }));
vi.mock("@/lib/account-pinned-goals-repo", () => ({
  getAccountPinnedGoals: async () => state.goals,
  upsertAccountPinnedGoal: async (accountId: string, goal: unknown) => {
    state.writes.push({ accountId, goal });
    return goal;
  },
  deleteAccountPinnedGoal: async (accountId: string, key: string) => {
    state.deletes.push({ accountId, key });
    return true;
  }
}));

beforeEach(() => {
  state.account = null;
  state.goals = [];
  state.writes = [];
  state.deletes = [];
  vi.resetModules();
});

function request(method: "GET" | "POST" | "DELETE", body?: unknown, origin?: string): Request {
  return new Request("https://www.scapestack.org/api/account/goals", {
    method,
    headers: {
      host: "www.scapestack.org",
      cookie: "scapestack_account=browser-token",
      "content-type": "application/json",
      ...(origin ? { origin } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

describe("owner pinned goal API", () => {
  it("keeps reads and writes behind the paired account", async () => {
    const route = await import("@/app/api/account/goals/route");
    expect((await route.GET(request("GET"))).status).toBe(401);
    expect(state.writes).toEqual([]);

    state.account = { accountId: "account-1", rsn: "lynx titan", displayName: "Lynx Titan", lastSeenAt: "2026-07-31T10:00:00.000Z" };
    const goal = createPinnedGoal({ kind: "level", skill: "Slayer", targetLevel: 99 })!;
    const saved = await route.POST(request("POST", { goal }));
    expect(saved.status).toBe(201);
    expect(state.writes).toEqual([{ accountId: "account-1", goal }]);

    const removed = await route.DELETE(request("DELETE", { key: goal.key }));
    expect(removed.status).toBe(200);
    expect(state.deletes).toEqual([{ accountId: "account-1", key: goal.key }]);
  });

  it("rejects a cross-origin mutation before touching account goals", async () => {
    state.account = { accountId: "account-1", rsn: "lynx titan", displayName: "Lynx Titan", lastSeenAt: "2026-07-31T10:00:00.000Z" };
    const goal = createPinnedGoal({ kind: "item", goalId: "fire-cape" })!;
    const { POST } = await import("@/app/api/account/goals/route");
    const response = await POST(request("POST", { goal }, "https://evil.example"));
    expect(response.status).toBe(403);
    expect(state.writes).toEqual([]);
  });
});
