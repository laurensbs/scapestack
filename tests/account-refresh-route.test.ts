import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RateLimitRule } from "@/lib/rate-attempt";

const state = {
  hiscores: null as { name: string; skills: unknown[]; activities: unknown[] } | null,
  registered: null as { accountId: string; registered: boolean } | null,
  refresh: null as Record<string, unknown> | null,
  attempts: [] as Array<{ rule: RateLimitRule; key: string }>,
  allow: true,
  retryAfter: 0,
  registerCalls: [] as Array<{ rsn: string; displayName: string }>,
  refreshCalls: [] as Array<{ accountId: string; rsn: string; source: string }>,
  knownCalls: [] as string[],
  known: null as { accountId: string; registered: boolean } | null,
  hiscoreCalls: 0
};

vi.mock("@/lib/hiscores", () => ({
  fetchHiscores: async () => {
    state.hiscoreCalls += 1;
    return state.hiscores;
  }
}));

vi.mock("@/lib/account-visit-repo", () => ({
  registerAccountVisit: async (input: { rsn: string; displayName: string }) => {
    state.registerCalls.push(input);
    return state.registered;
  },
  recordVisitForKnownAccount: async (rsn: string) => {
    state.knownCalls.push(rsn);
    return state.known;
  }
}));

vi.mock("@/lib/hiscore-refresh", () => ({
  refreshAccountHiscores: async (input: { accountId: string; rsn: string; source: string }) => {
    state.refreshCalls.push(input);
    return state.refresh;
  }
}));

vi.mock("@/lib/rate-attempt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-attempt")>();
  return {
    ...actual,
    checkAndRecordAttempt: async (rule: RateLimitRule, key: string) => {
      state.attempts.push({ rule, key });
      return { allowed: state.allow, retryAfterSeconds: state.retryAfter };
    }
  };
});

const { POST: refreshPost } = await import("@/app/api/account/refresh/route");
const { POST: visitPost } = await import("@/app/api/account/visit/route");
const { RATE_LIMITS } = await import("@/lib/rate-attempt");

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://scapestack.gg/api/account/refresh", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
}

const HISCORES = { name: "Lauky", skills: [{ id: 1, name: "Slayer", rank: 1, level: 92, xp: 6_800_000 }], activities: [] };

beforeEach(() => {
  state.hiscores = HISCORES;
  state.registered = { accountId: "acc-1", registered: false };
  state.refresh = {
    status: "refreshed",
    delta: { since: "2026-08-08T00:00:00.000Z", xpGained: 300_000, levelsGained: 1, levelUps: [], kcGained: {}, moved: true },
    milestones: 2
  };
  state.attempts = [];
  state.allow = true;
  state.retryAfter = 0;
  state.registerCalls = [];
  state.refreshCalls = [];
  state.knownCalls = [];
  state.known = null;
  state.hiscoreCalls = 0;
});

describe("Refresh now", () => {
  it("meters per RSN, which is what actually costs Jagex a request", async () => {
    // Per session, ten browsers refresh the same player sixty times an hour.
    // Per address, a household shares one budget. The name is the unit of cost.
    await refreshPost(post({ rsn: "Lauky" }));
    expect(state.attempts).toHaveLength(1);
    expect(state.attempts[0].key).toBe("lauky");
    expect(state.attempts[0].rule).toBe(RATE_LIMITS.refreshPerRsn);
  });

  it("is one per ten minutes, per the spec", () => {
    expect(RATE_LIMITS.refreshPerRsn.limit).toBe(1);
    expect(RATE_LIMITS.refreshPerRsn.windowMinutes).toBe(10);
  });

  it("refuses over the limit, and says when to come back", async () => {
    state.allow = false;
    state.retryAfter = 360;
    const response = await refreshPost(post({ rsn: "Lauky" }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("360");
    const body = await response.json() as { error: string };
    expect(body.error).toBe("Already checked. Try again in 6 minutes.");
    // And it must not have gone to Jagex anyway.
    expect(state.refreshCalls).toEqual([]);
  });

  it("reads Jagex once when allowed, through the same path the cron uses", async () => {
    const response = await refreshPost(post({ rsn: "Lauky" }));
    expect(response.status).toBe(200);
    expect(state.refreshCalls).toEqual([{ accountId: "acc-1", rsn: "Lauky", source: "manual" }]);
    const body = await response.json() as { xpGained: number; milestones: number };
    expect(body.xpGained).toBe(300_000);
    expect(body.milestones).toBe(2);
  });

  it("returns unknown, not zero, on a first-ever reading", async () => {
    state.refresh = {
      status: "refreshed",
      delta: { since: null, xpGained: 0, levelsGained: 0, levelUps: [], kcGained: {}, moved: false },
      milestones: 0
    };
    const body = await (await refreshPost(post({ rsn: "Lauky" }))).json() as { since: string | null; moved: boolean };
    expect(body.since).toBeNull();
    expect(body.moved).toBe(false);
  });

  it("says the hiscores are down rather than reporting a zero week", async () => {
    // "You gained nothing" and "we could not check" are different sentences,
    // and only one of them is true during an outage.
    state.refresh = { status: "unreachable" };
    const response = await refreshPost(post({ rsn: "Lauky" }));
    expect(response.status).toBe(503);
    const body = await response.json() as { error: string };
    expect(body.error).toContain("did not answer");
  });

  it("rejects a request that did not come from this site", async () => {
    const response = await refreshPost(post({ rsn: "Lauky" }, { origin: "https://evil.example" }));
    expect(response.status).toBe(403);
    expect(state.attempts).toEqual([]);
  });

  it("rejects an empty name without spending an attempt on Jagex", async () => {
    const response = await refreshPost(post({ rsn: "   " }));
    expect(response.status).toBe(400);
    expect(state.refreshCalls).toEqual([]);
  });
});

describe("the visit ping", () => {
  function visit(body: unknown, headers: Record<string, string> = {}): Request {
    return new Request("https://scapestack.gg/api/account/visit", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body)
    });
  }

  it("will not put an unverified name into the cron's roster", async () => {
    // An identity row is what schedules a daily request to Jagex for that
    // name. A roster that accepts arbitrary strings is a way to make
    // Scapestack fetch anything, on a schedule, for free.
    state.hiscores = null;
    const response = await visitPost(visit({ rsn: "not a real player" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, registered: false, reason: "not_ranked" });
    expect(state.registerCalls).toEqual([]);
  });

  it("registers a name the hiscores confirm", async () => {
    const response = await visitPost(visit({ rsn: "Lauky" }));
    expect(response.status).toBe(200);
    expect(state.registerCalls).toEqual([{ rsn: "Lauky", displayName: "Lauky" }]);
  });

  it("does not go to Jagex for a player already in the roster", async () => {
    // The hiscores check exists to stop an arbitrary string entering the cron's
    // roster. A name already in it passed that check when it got there, and
    // re-running it puts a request to Jagex behind every returning player —
    // the exact visitor this item was built to serve.
    state.known = { accountId: "acc-1", registered: false };
    const response = await visitPost(visit({ rsn: "Lauky" }));
    expect(response.status).toBe(200);
    expect(state.knownCalls).toEqual(["Lauky"]);
    expect(state.hiscoreCalls).toBe(0);
    expect(state.registerCalls).toEqual([]);
    // And a returning visit spends nothing from the registration budget.
    expect(state.attempts).toEqual([]);
  });

  it("caps how fast one address can grow the roster", async () => {
    await visitPost(visit({ rsn: "Lauky" }));
    expect(state.attempts[0].rule).toBe(RATE_LIMITS.registerPerAddress);
  });

  it("rejects a cross-origin ping", async () => {
    const response = await visitPost(visit({ rsn: "Lauky" }, { origin: "https://evil.example" }));
    expect(response.status).toBe(403);
    expect(state.registerCalls).toEqual([]);
  });
});
