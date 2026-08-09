import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HiscoreSnapshotRow } from "@/lib/hiscore-snapshot-repo";
import type { PinnedGoal } from "@/lib/pinned-goals";
import { weekStart } from "@/lib/weekly-recap-repo";

/**
 * The job, with the database and Discord replaced.
 *
 * The interesting assertions are all negative — a quiet week is not sent, a
 * failed post is not marked delivered, a dead webhook is not retried forever —
 * and none of them can be made against a real Sunday.
 */

const snapshots = { baseline: null as HiscoreSnapshotRow | null, closing: null as HiscoreSnapshotRow | null };
let goals: PinnedGoal[] = [];
let clog = { before: null as number | null, after: null as number | null };

const upserts: unknown[] = [];
const claims: Array<{ accountId: string; week: string }> = [];
const releases: Array<{ accountId: string; week: string }> = [];
const cleared: string[] = [];
let claimReturns: string | null = "tok-1";

vi.mock("@/lib/hiscore-snapshot-repo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/hiscore-snapshot-repo")>()),
  hiscoreSnapshotBefore: async () => snapshots.baseline,
  latestHiscoreSnapshot: async () => snapshots.closing
}));

vi.mock("@/lib/account-pinned-goals-repo", () => ({
  getAccountPinnedGoals: async () => goals
}));

vi.mock("@/lib/weekly-recap-repo", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/weekly-recap-repo")>();
  return {
    ...original,
    upsertWeeklyProgress: async (input: unknown) => { upserts.push(input); },
    claimRecapSend: async (accountId: string, week: string) => {
      claims.push({ accountId, week });
      return claimReturns;
    },
    releaseRecapSend: async (accountId: string, week: string) => { releases.push({ accountId, week }); },
    clearDiscordWebhook: async (accountId: string) => { cleared.push(accountId); },
    clogSlotsAround: async () => clog
  };
});

const { runWeeklyRecap } = await import("@/lib/weekly-recap-job");

function snapshot(takenAt: string, slayerXp: number, zulrahKc = 100): HiscoreSnapshotRow {
  return {
    takenAt,
    skills: { overall: { level: 1500, xp: 90_000_000, rank: 1 }, slayer: { level: 92, xp: slayerXp, rank: 2 } },
    bosses: { zulrah: { kc: zulrahKc, rank: 3 } },
    source: "cron"
  };
}

const NOW = new Date("2026-08-09T18:00:00.000Z");
const WEBHOOK = "https://discord.com/api/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz0123456789";
const CANDIDATE = { accountId: "11111111-1111-4111-8111-111111111111", rsn: "lauky", discordWebhookUrl: WEBHOOK };

function run(post: (url: string, payload: unknown) => Promise<{ status: string } & Record<string, unknown>>) {
  return runWeeklyRecap({
    now: NOW,
    limit: 10,
    candidates: async () => [CANDIDATE],
    post: post as never
  });
}

beforeEach(() => {
  upserts.length = 0;
  claims.length = 0;
  releases.length = 0;
  cleared.length = 0;
  claimReturns = "tok-1";
  goals = [];
  clog = { before: null, after: null };
  snapshots.baseline = snapshot("2026-08-02T05:00:00.000Z", 7_000_000, 100);
  snapshots.closing = snapshot("2026-08-09T05:00:00.000Z", 8_200_000, 112);
});

describe("the Sunday run", () => {
  it("summarises the week that is ending, not the one beginning", () => {
    // Sunday is the seventh day of the week it closes. Getting this backwards
    // would send a recap of a week with one day in it.
    expect(weekStart(NOW)).toBe("2026-08-03");
  });

  it("sends a week that moved, once, with a token in the link", async () => {
    const post = vi.fn(async (_url: string, _payload: unknown) => ({ status: "sent" as const }));
    const outcome = await run(post);
    expect(outcome.sent).toBe(1);
    expect(claims).toHaveLength(1);
    expect(releases).toHaveLength(0);
    const payload = post.mock.calls[0]?.[1] as { embeds: Array<{ url: string }> };
    expect(payload.embeds[0].url).toBe("https://www.scapestack.org/r/tok-1");
  });

  it("records a quiet week but does not send it", async () => {
    // "You gained nothing this week" is a reason to mute the channel. The row
    // is still written — the streak and the history want it — and nothing is
    // posted.
    snapshots.closing = snapshot("2026-08-09T05:00:00.000Z", 7_000_000, 100);
    const post = vi.fn(async () => ({ status: "sent" as const }));
    const outcome = await run(post);
    expect(outcome.skippedQuiet).toBe(1);
    expect(outcome.sent).toBe(0);
    expect(post).not.toHaveBeenCalled();
    expect(upserts).toHaveLength(1);
    expect(claims).toHaveLength(0);
  });

  it("gives the claim back when Discord did not take the message", async () => {
    // Otherwise one hiccup silently costs a player their recap and shows up in
    // §7 as a delivery rate nobody can explain.
    const post = vi.fn(async () => ({ status: "failed" as const, code: 500 }));
    const outcome = await run(post);
    expect(outcome.sent).toBe(0);
    expect(outcome.failed).toBe(1);
    expect(releases).toEqual([{ accountId: CANDIDATE.accountId, week: "2026-08-03" }]);
    expect(cleared).toHaveLength(0);
  });

  it("forgets a webhook Discord says is deleted", async () => {
    const post = vi.fn(async () => ({ status: "gone" as const }));
    const outcome = await run(post);
    expect(outcome.webhooksCleared).toBe(1);
    expect(cleared).toEqual([CANDIDATE.accountId]);
  });

  it("does not post twice when the claim was already taken", async () => {
    // Two overlapping invocations — a retry, a manual trigger — must not both
    // post to a player's clan Discord.
    claimReturns = null;
    const post = vi.fn(async () => ({ status: "sent" as const }));
    const outcome = await run(post);
    expect(post).not.toHaveBeenCalled();
    expect(outcome.sent).toBe(0);
  });

  it("says why it built nothing rather than reporting an empty run", async () => {
    snapshots.baseline = null;
    const post = vi.fn(async () => ({ status: "sent" as const }));
    const outcome = await run(post);
    expect(outcome.skippedNoData).toBe(1);
    expect(outcome.built).toBe(0);
    expect(post).not.toHaveBeenCalled();
  });
});
