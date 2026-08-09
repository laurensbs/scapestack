import { getAccountPinnedGoals } from "./account-pinned-goals-repo";
import { BRAND_URL } from "./brand";
import { postDiscordWebhook, type DiscordPostResult } from "./discord-webhook";
import { hiscoreSnapshotBefore, latestHiscoreSnapshot } from "./hiscore-snapshot-repo";
import type { PinnedGoal } from "./pinned-goals";
import { recapDiscordEmbed, weekIsWorthSending } from "./weekly-recap";
import { buildRecapWeek, type WeekSkipReason } from "./weekly-recap-build";
import {
  claimRecapSend,
  clearDiscordWebhook,
  clogSlotsAround,
  recapCandidates,
  releaseRecapSend,
  upsertWeeklyProgress,
  weekStart,
  type RecapRecipient
} from "./weekly-recap-repo";

/**
 * The Sunday recap (SPEC §2.3 job 2, §3.3) — the #1 return trigger.
 *
 * Kept out of the route so the whole job can be driven in a test with fake
 * dependencies: what gets built, what gets sent, and — the part that matters —
 * what does NOT get sent.
 */

export interface RecapRunOutcome {
  weekStart: string;
  considered: number;
  built: number;
  sent: number;
  skippedQuiet: number;
  skippedNoData: number;
  failed: number;
  webhooksCleared: number;
  /** True when the clock budget stopped the run before the queue was done. */
  ranOutOfTime: boolean;
  /** How many candidates were left. Silence here would read as "all done". */
  unprocessed: number;
}

/** Discord's timeout in discord-webhook.ts, plus room for the write after it. */
const DISCORD_ROUND_TRIP_MS = 10_000;

export interface RecapRunDeps {
  now: Date;
  limit: number;
  candidates: (week: string, limit: number) => Promise<RecapRecipient[]>;
  post: (url: string, payload: unknown) => Promise<DiscordPostResult>;
  /**
   * Wall-clock budget. The loop is serial and every candidate costs an HTTPS
   * POST with an 8s ceiling, so a count alone cannot bound it — the sibling
   * hiscores job learned this and this one had not. Without it, a handful of
   * webhooks pointed at a black hole eat the whole function and every player
   * below them in the queue silently loses that week.
   */
  budgetMs?: number;
  /** Injected so the budget can be exercised without waiting for real time. */
  elapsedMs?: () => number;
}

/**
 * How many weeks back a run will still send for.
 *
 * A recap that failed to deliver — a 500, a rate-limit, a timeout — used to be
 * released and then never looked at again, because the next run only ever
 * asked about ITS week. One week of catch-up means a transient Discord problem
 * costs a delay rather than the message.
 */
const CATCH_UP_WEEKS = 1;

const DAY_MS = 86_400_000;

function primaryGoal(goals: readonly PinnedGoal[]): PinnedGoal | null {
  return goals.find((goal) => goal.isPrimary) ?? goals[0] ?? null;
}

const NO_DATA: readonly WeekSkipReason[] = ["no-baseline", "baseline-too-old", "closing-too-old"];

/** Every week this run may still send for, newest first. */
function weeksToSend(now: Date): string[] {
  const weeks: string[] = [];
  for (let back = 0; back <= CATCH_UP_WEEKS; back += 1) {
    weeks.push(weekStart(new Date(now.getTime() - back * 7 * DAY_MS)));
  }
  return weeks;
}

/**
 * Has the week being described actually finished?
 *
 * The route is callable by hand with CRON_SECRET, and that is the only way to
 * retry a failed send. Without this check a Wednesday invocation builds
 * Monday-to-Wednesday, posts it as "This week", stamps the row as sent — and
 * Sunday's real run then skips the account. Half a week, announced as a whole
 * one, blocking the whole one.
 */
function weekHasClosed(week: string, now: Date): boolean {
  // The week starting Monday `week` closes at the end of the following Sunday.
  const closesAt = new Date(`${week}T00:00:00.000Z`).getTime() + 6 * DAY_MS;
  return now.getTime() >= closesAt;
}

export async function runWeeklyRecap(deps: RecapRunDeps): Promise<RecapRunOutcome> {
  const budgetMs = deps.budgetMs ?? Number.POSITIVE_INFINITY;
  const startedAt = Date.now();
  const elapsed = deps.elapsedMs ?? (() => Date.now() - startedAt);

  const weeks = weeksToSend(deps.now).filter((candidateWeek) => weekHasClosed(candidateWeek, deps.now));
  const outcome: RecapRunOutcome = {
    weekStart: weeks[0] ?? weekStart(deps.now),
    considered: 0,
    built: 0,
    sent: 0,
    skippedQuiet: 0,
    skippedNoData: 0,
    failed: 0,
    webhooksCleared: 0,
    ranOutOfTime: false,
    unprocessed: 0
  };

  // Newest week first, then last week's stragglers — a player who is owed both
  // gets the current one, which is the one they can still act on.
  const queue: Array<{ week: string; candidate: RecapRecipient }> = [];
  for (const candidateWeek of weeks) {
    for (const candidate of await deps.candidates(candidateWeek, deps.limit)) {
      queue.push({ week: candidateWeek, candidate });
    }
  }
  outcome.considered = queue.length;

  for (const [index, entry] of queue.entries()) {
    // Leave room for one more full Discord round trip. Stopping short is
    // normal and is reported; being killed mid-POST is not, because the claim
    // is already stamped and nothing would ever release it.
    if (elapsed() > budgetMs - DISCORD_ROUND_TRIP_MS) {
      outcome.ranOutOfTime = true;
      outcome.unprocessed = queue.length - index;
      break;
    }

    const { week, candidate } = entry;
    const [baseline, closing, goals, clog] = await Promise.all([
      hiscoreSnapshotBefore(candidate.accountId, new Date(`${week}T00:00:00.000Z`)),
      latestHiscoreSnapshot(candidate.accountId),
      getAccountPinnedGoals(candidate.accountId),
      clogSlotsAround(candidate.accountId, week)
    ]);

    const goal = primaryGoal(goals);
    const built = buildRecapWeek({
      rsn: candidate.rsn,
      weekStart: week,
      baseline,
      closing,
      goal,
      clogBefore: clog.before,
      clogAfter: clog.after,
      // Filled in after the send is claimed: the token is what makes the click
      // countable, and it does not exist until the row says this recap is ours
      // to send.
      nextStepUrl: `${BRAND_URL}/p/${encodeURIComponent(candidate.rsn)}`,
      // The end of the week being described, not the moment of the run. The
      // freshness guard asks "is the closing reading near the end of this
      // week", and against a wall clock it would reject every catch-up week
      // for being a week old — which is exactly what a catch-up week is.
      now: new Date(new Date(`${week}T00:00:00.000Z`).getTime() + 7 * DAY_MS)
    });

    if (!built.week) {
      if (NO_DATA.includes(built.skipped ?? "no-baseline")) outcome.skippedNoData += 1;
      continue;
    }

    outcome.built += 1;
    await upsertWeeklyProgress({
      accountId: candidate.accountId,
      weekStart: week,
      xpGained: built.week.xpGained,
      levelsGained: built.week.levelsGained,
      kcGained: built.week.kcGained,
      clogSlotsGained: built.week.clogSlotsGained,
      goalProgress: built.week.goal
        ? { [built.week.goal.target]: { pctBefore: built.week.goal.pctBefore, pctAfter: built.week.goal.pctAfter } }
        : {},
      // §5.1: a week counts towards a streak because the player played, not
      // because they opened the site. The row records the fact; nothing in
      // Phase 1 rewards it.
      qualifiedForStreak: weekIsWorthSending(built.week)
    });

    // A quiet week is still recorded — the streak and the history want it —
    // but it is not sent. "You gained nothing this week" is a reason to mute
    // the channel, and the recap only exists to be worth opening.
    if (!weekIsWorthSending(built.week)) {
      outcome.skippedQuiet += 1;
      continue;
    }

    const token = await claimRecapSend(candidate.accountId, week, "discord");
    if (!token) continue;

    const payload = recapDiscordEmbed({ ...built.week, nextStepUrl: `${BRAND_URL}/r/${token}` });
    const result = await deps.post(candidate.discordWebhookUrl, payload);

    if (result.status === "sent") {
      outcome.sent += 1;
      continue;
    }

    // Nothing was delivered, so the claim is given back and next week's run —
    // or a re-run of this one — may try again. Without this a single Discord
    // hiccup silently costs a player their recap and shows up in §7 as a
    // delivery rate nobody can explain.
    await releaseRecapSend(candidate.accountId, week);
    outcome.failed += 1;

    if (result.status === "gone" || result.status === "rejected") {
      // Discord says the webhook is deleted, or it was never Discord's to
      // begin with. Retrying it every Sunday forever is how a service ends up
      // hammering a dead endpoint; clear it and let the player set a new one.
      await clearDiscordWebhook(candidate.accountId);
      outcome.webhooksCleared += 1;
    }
  }

  return outcome;
}

export const defaultRecapDeps = {
  candidates: recapCandidates,
  post: (url: string, payload: unknown) => postDiscordWebhook(url, payload)
};
