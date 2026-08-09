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
}

export interface RecapRunDeps {
  now: Date;
  limit: number;
  candidates: (week: string, limit: number) => Promise<RecapRecipient[]>;
  post: (url: string, payload: unknown) => Promise<DiscordPostResult>;
}

function primaryGoal(goals: readonly PinnedGoal[]): PinnedGoal | null {
  return goals.find((goal) => goal.isPrimary) ?? goals[0] ?? null;
}

const NO_DATA: readonly WeekSkipReason[] = ["no-baseline", "baseline-too-old", "closing-too-old"];

export async function runWeeklyRecap(deps: RecapRunDeps): Promise<RecapRunOutcome> {
  const week = weekStart(deps.now);
  const candidates = await deps.candidates(week, deps.limit);
  const outcome: RecapRunOutcome = {
    weekStart: week,
    considered: candidates.length,
    built: 0,
    sent: 0,
    skippedQuiet: 0,
    skippedNoData: 0,
    failed: 0,
    webhooksCleared: 0
  };

  for (const candidate of candidates) {
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
      now: deps.now
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
