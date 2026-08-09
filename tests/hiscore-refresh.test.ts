import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HiscoreSnapshotRow } from "@/lib/hiscore-snapshot-repo";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

interface State {
  hiscores: { name: string; skills: unknown[]; activities: unknown[] } | null;
  throws: Error | null;
  latest: HiscoreSnapshotRow | null;
  checked: string[];
  written: Array<{ accountId: string; source: string }>;
  milestoneCalls: number;
  signalTimeouts: number[];
}

const state: State = {
  hiscores: null,
  throws: null,
  latest: null,
  checked: [],
  written: [],
  milestoneCalls: 0,
  signalTimeouts: []
};

vi.mock("@/lib/hiscores", () => ({
  fetchHiscores: async (_rsn: string, options: { strict?: boolean; signal?: AbortSignal } = {}) => {
    // The deadline is the number under test in one case below, so capture it.
    state.signalTimeouts.push(Number((options.signal as unknown as { __ms?: number })?.__ms ?? 0));
    if (state.throws) {
      if (options.strict) throw state.throws;
      return null;
    }
    return state.hiscores;
  }
}));

vi.mock("@/lib/hiscore-snapshot-repo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/hiscore-snapshot-repo")>();
  return {
    ...actual,
    latestHiscoreSnapshot: async () => state.latest,
    recordHiscoreSnapshot: async (input: { accountId: string; source: string }) => {
      state.written.push({ accountId: input.accountId, source: input.source });
    },
    markHiscoreChecked: async (accountId: string) => {
      state.checked.push(accountId);
    },
    accountsDueForRefresh: async () => []
  };
});

vi.mock("@/lib/milestone-repo", () => ({
  recordMilestones: async (_accountId: string, candidates: readonly unknown[]) => {
    state.milestoneCalls += 1;
    return candidates.length;
  }
}));

const { HISCORE_REFRESH_DEADLINE_MS, refreshAccountHiscores } = await import("@/lib/hiscore-refresh");
const { PLANNING_SOURCE_DEADLINES_MS } = await import("@/lib/planning-context");

function hiscores(level: number, xp: number, kc: number) {
  return {
    name: "Lauky",
    skills: [{ id: 1, name: "Slayer", rank: 50_000, level, xp }],
    activities: [{ id: 2, name: "Zulrah", rank: 4_000, score: kc }]
  };
}

function snapshot(level: number, xp: number, kc: number): HiscoreSnapshotRow {
  return {
    takenAt: "2026-08-08T00:00:00.000Z",
    skills: { slayer: { level, xp, rank: 50_000 } },
    bosses: { zulrah: { kc, rank: 4_000 } },
    source: "cron"
  };
}

beforeEach(() => {
  state.hiscores = hiscores(92, 6_800_000, 812);
  state.throws = null;
  state.latest = null;
  state.checked = [];
  state.written = [];
  state.milestoneCalls = 0;
  state.signalTimeouts = [];
});

describe("the cron waits on Jagex like a job, not like a page", () => {
  it("does not use the page-render deadline", () => {
    // 900ms is what a page can afford while a player watches a spinner; it
    // falls back to cached data when it runs out. A cron has no spinner and no
    // fallback — giving up at 900ms turns a slow-but-healthy response into a
    // hole in the time series, and the day it dropped is not recoverable.
    expect(HISCORE_REFRESH_DEADLINE_MS).toBeGreaterThan(PLANNING_SOURCE_DEADLINES_MS.hiscores * 4);
    expect(read("src/app/api/cron/hiscores/route.ts")).not.toContain("PLANNING_SOURCE_DEADLINES_MS");
  });

  it("leaves room for one whole request inside the function's wall clock", () => {
    // The old shape was a fixed count with no clock check, which only fit
    // because the deadline was 900ms. At a realistic deadline, 40 accounts is
    // five minutes and the function is killed mid-write.
    const route = read("src/app/api/cron/hiscores/route.ts");
    const budget = Number(/const BUDGET_MS = ([\d_]+);/.exec(route)?.[1]?.replace(/_/g, ""));
    const maxDuration = Number(/export const maxDuration = (\d+);/.exec(route)?.[1]);
    expect(budget).toBeGreaterThan(0);
    expect(budget + HISCORE_REFRESH_DEADLINE_MS).toBeLessThanOrEqual(maxDuration * 1000);
    expect(route).toContain("Date.now() - startedAt > BUDGET_MS - HISCORE_REFRESH_DEADLINE_MS");
  });
});

describe("the refresh stamps the attempt, whatever came of it", () => {
  it("stamps after a successful read", async () => {
    const outcome = await refreshAccountHiscores({ accountId: "acc-1", rsn: "lauky", source: "cron" });
    expect(outcome.status).toBe("refreshed");
    expect(state.checked).toEqual(["acc-1"]);
  });

  it("stamps a player who is not on the hiscores", async () => {
    // This is the whole point. An unranked name never writes a snapshot, so a
    // queue ordered by last success keeps it at the head forever and it takes
    // a slot in every batch. Enough of them and no ranked player is refreshed
    // again — the roster stops draining entirely.
    state.hiscores = null;
    const outcome = await refreshAccountHiscores({ accountId: "acc-2", rsn: "nobody", source: "cron" });
    expect(outcome.status).toBe("not_ranked");
    expect(state.checked).toEqual(["acc-2"]);
    expect(state.written).toEqual([]);
  });

  it("stamps when Jagex does not answer", async () => {
    state.throws = new Error("TimeoutError");
    const outcome = await refreshAccountHiscores({ accountId: "acc-3", rsn: "lauky", source: "cron" });
    expect(outcome.status).toBe("unreachable");
    expect(state.checked).toEqual(["acc-3"]);
    expect(state.written).toEqual([]);
  });
});

describe("an outage and an unranked player are different answers", () => {
  it("separates them, so a Jagex outage cannot hide inside a normal-looking count", async () => {
    // Without strict:true both are null. The cron would then report a healthy
    // "not ranked" number through an outage, and every player's time series
    // would quietly stop.
    state.hiscores = null;
    expect((await refreshAccountHiscores({ accountId: "a", rsn: "x", source: "cron" })).status)
      .toBe("not_ranked");
    state.throws = new Error("fetch failed");
    expect((await refreshAccountHiscores({ accountId: "a", rsn: "x", source: "cron" })).status)
      .toBe("unreachable");
  });
});

describe("the cron keeps the series unbroken even when nothing moved", () => {
  it("writes a flat day rather than a gap", async () => {
    // The dedupe used to apply to the cron too, and an account nobody is
    // playing reads identically every day — so a two-week break left a
    // two-week hole. The weekly recap needs a reading from just before the
    // week to describe it, so the player who came back and had a huge week
    // got nothing. That is the one case §3.3 exists for.
    //
    // A flat row is not noise. It is the evidence that nothing moved, and the
    // daily unique index already budgets for one row a day.
    state.latest = snapshot(92, 6_800_000, 812);
    const outcome = await refreshAccountHiscores({ accountId: "acc-idle", rsn: "lauky", source: "cron" });
    expect(outcome.status).toBe("refreshed");
    expect(state.written).toEqual([{ accountId: "acc-idle", source: "cron" }]);
    // Still honest about what happened: a written row is not a claim of progress.
    expect(outcome.status === "refreshed" && outcome.delta.moved).toBe(false);
  });
});

describe("the on-demand path does not pad the time series", () => {
  it("writes nothing when the reading is identical to the last one", async () => {
    // One per RSN per ten minutes is 144 rows a day for a player who did not
    // play. sync_snapshot already dedupes by checksum; this is the same rule.
    state.latest = snapshot(92, 6_800_000, 812);
    const outcome = await refreshAccountHiscores({ accountId: "acc-4", rsn: "lauky", source: "manual" });
    expect(outcome.status).toBe("refreshed");
    expect(state.written).toEqual([]);
    expect(outcome.status === "refreshed" && outcome.delta.moved).toBe(false);
  });

  it("writes when anything actually moved", async () => {
    state.latest = snapshot(92, 6_800_000, 800);
    const outcome = await refreshAccountHiscores({ accountId: "acc-5", rsn: "lauky", source: "manual" });
    expect(state.written).toEqual([{ accountId: "acc-5", source: "manual" }]);
    expect(outcome.status === "refreshed" && outcome.delta.kcGained).toEqual({ zulrah: 12 });
  });

  it("is not fooled by a rank that drifted while the player slept", async () => {
    // Rank moves whenever anyone else in the game plays. A rank-sensitive
    // comparison is never equal, and the dedupe above would never once fire.
    state.latest = {
      ...snapshot(92, 6_800_000, 812),
      skills: { slayer: { level: 92, xp: 6_800_000, rank: 999_999 } },
      bosses: { zulrah: { kc: 812, rank: 999_999 } }
    };
    await refreshAccountHiscores({ accountId: "acc-6", rsn: "lauky", source: "manual" });
    expect(state.written).toEqual([]);
  });

  it("writes the first ever reading rather than treating absent as identical", async () => {
    state.latest = null;
    await refreshAccountHiscores({ accountId: "acc-7", rsn: "lauky", source: "manual" });
    expect(state.written).toEqual([{ accountId: "acc-7", source: "manual" }]);
  });
});

describe("the queue drains by attempt, not by success", () => {
  it("orders and filters on hiscore_checked_at", async () => {
    const repo = read("src/lib/hiscore-snapshot-repo.ts");
    const start = repo.indexOf("export async function accountsDueForRefresh");
    const body = repo.slice(start, repo.indexOf("export async function markHiscoreChecked"));
    expect(body).toContain("ORDER BY i.hiscore_checked_at ASC NULLS FIRST");
    expect(body).toContain("i.hiscore_checked_at < NOW() - INTERVAL '20 hours'");
    // The bug this replaced: ordering by the newest snapshot, which an
    // unranked account never has.
    expect(body).not.toContain("FROM hiscore_snapshot");
  });

  it("backfills the column it now reads, in the same commit that adds it", async () => {
    const schema = read("src/lib/sync-schema.ts");
    expect(schema).toContain("ADD COLUMN IF NOT EXISTS hiscore_checked_at TIMESTAMPTZ");
    expect(schema).toContain("SET hiscore_checked_at = s.taken_at");
    // Left NULL, every existing account is due at once and the first run after
    // deploy hands Jagex the entire roster in one batch.
    expect(schema).toMatch(/UPDATE account_identity i\s+SET hiscore_checked_at/);
  });
});
