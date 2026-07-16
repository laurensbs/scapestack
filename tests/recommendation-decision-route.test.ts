import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildRecommendationDecision } from "@/lib/recommendation-decision";
import type { Recommendation } from "@/lib/next-up";

const state = vi.hoisted(() => ({
  account: null as null | { accountId: string; rsn: string; displayName: string; lastSeenAt: string },
  saved: null as unknown,
  lifecycle: null as unknown,
  result: { decisionId: 12, created: true } as { decisionId: number; created: boolean } | null,
  error: null as Error | null
}));

vi.mock("@/lib/account-pairing", () => ({
  getConnectedAccount: async () => state.account
}));
vi.mock("@/lib/account-history-repo", () => ({
  recordRecommendationDecisionForAccount: async (accountId: string, decision: unknown) => {
    if (state.error) throw state.error;
    state.saved = { accountId, decision };
    return state.result;
  },
  recordRecommendationLifecycleForAccount: async (input: unknown) => {
    state.lifecycle = input;
    return { eventId: 44, created: true };
  }
}));

beforeEach(() => {
  state.account = null;
  state.saved = null;
  state.lifecycle = null;
  state.result = { decisionId: 12, created: true };
  state.error = null;
});

describe("connected recommendation decision API", () => {
  it("never stores a plan without an authenticated RuneLite account", async () => {
    const { POST } = await import("@/app/api/account/decision/route");
    const response = await POST(request({ decision: validDecision() }));
    expect(response.status).toBe(401);
    expect(state.saved).toBeNull();
  });

  it("stores a valid contract against the connected account, not a browser RSN", async () => {
    state.account = { accountId: "account-1", rsn: "lauky", displayName: "Lauky", lastSeenAt: "2026-07-16T10:00:00Z" };
    const { POST } = await import("@/app/api/account/decision/route");
    const response = await POST(request({ decision: validDecision(), rsn: "someone-else" }, true));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, created: true, decisionId: 12 });
    expect(state.saved).toMatchObject({ accountId: "account-1", decision: { recommendationId: "quest:dragon-slayer-ii" } });
  });

  it("rejects incomplete contracts and hides database details", async () => {
    state.account = { accountId: "account-1", rsn: "lauky", displayName: "Lauky", lastSeenAt: "2026-07-16T10:00:00Z" };
    const { POST } = await import("@/app/api/account/decision/route");
    expect((await POST(request({ decision: { version: 1 } }, true))).status).toBe(400);

    state.error = new Error("private neon detail");
    const response = await POST(request({ decision: validDecision() }, true));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "Could not save that plan" });
  });

  it("links an explicit start to the exact persisted decision", async () => {
    state.account = { accountId: "account-1", rsn: "lauky", displayName: "Lauky", lastSeenAt: "2026-07-16T10:00:00Z" };
    const { POST } = await import("@/app/api/account/decision/route");
    const response = await POST(request({ decision: validDecision(), eventType: "started" }, true));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ eventId: 44, eventCreated: true, decisionId: 12 });
    expect(state.lifecycle).toMatchObject({ accountId: "account-1", decisionId: 12, eventType: "started" });
  });

  it("rejects unsupported lifecycle actions", async () => {
    state.account = { accountId: "account-1", rsn: "lauky", displayName: "Lauky", lastSeenAt: "2026-07-16T10:00:00Z" };
    const { POST } = await import("@/app/api/account/decision/route");
    const response = await POST(request({ decision: validDecision(), eventType: "claimed" }, true));
    expect(response.status).toBe(400);
    expect(state.lifecycle).toBeNull();
  });
});

function request(body: unknown, connected = false): Request {
  return new Request("http://local/api/account/decision", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(connected ? { cookie: "scapestack_account=session" } : {})
    },
    body: JSON.stringify(body)
  });
}

function validDecision() {
  const winner: Recommendation = {
    id: "quest:dragon-slayer-ii",
    kind: "quest",
    title: "Complete Dragon Slayer II",
    why: "Unlock Vorkath.",
    score: 80,
    actionPlan: {
      timebox: "60 min",
      confidence: "exact",
      confidenceLabel: "Exact",
      prep: "Open the next quest step.",
      steps: ["Complete the next quest block.", "Stop after the quest reward."]
    }
  };
  return buildRecommendationDecision({
    winner,
    alternatives: [],
    mood: "unlock",
    routeFamily: "unlock-chain",
    minutes: 60,
    accountStage: "midgame-main",
    accountType: "regular",
    hasPublicStats: true,
    hasBank: false,
    hasRuneLite: true
  });
}
