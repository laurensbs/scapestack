import {
  hiscoreDelta,
  latestHiscoreSnapshot,
  markHiscoreChecked,
  recordHiscoreSnapshot,
  snapshotBossesFrom,
  snapshotSkillsFrom,
  type HiscoreDelta,
  type HiscoreSnapshotRow,
  type HiscoreSnapshotSource
} from "./hiscore-snapshot-repo";
import { fetchHiscores } from "./hiscores";
import { recordMilestones } from "./milestone-repo";
import { milestonesFromDelta } from "./milestone-thresholds";

/**
 * One reading of the hiscores, written once.
 *
 * The daily cron and the on-demand "Refresh now" both come through here. Two
 * write paths into the same time series is two places to get the delta, the
 * milestone dedupe and the false-zero rule subtly different, and a time series
 * that disagrees with itself is worse than none.
 */

/**
 * How long to wait on Jagex, in a job with nobody watching.
 *
 * Deliberately NOT PLANNING_SOURCE_DEADLINES_MS.hiscores. That number is 900ms
 * because a page has to answer inside a second and falls back to cached data
 * when it cannot — the right trade when a player is staring at a spinner. Here
 * there is no spinner, and giving up at 900ms turns every slow-but-healthy
 * response into a hole in the time series. A hole is not recoverable: the day
 * is gone, and every delta that spans it is wrong.
 */
export const HISCORE_REFRESH_DEADLINE_MS = 8_000;

/**
 * Same achievement, ignoring when it was read.
 *
 * Compares XP, level and KC — and deliberately NOT rank. Rank moves whenever
 * anyone else in the game plays, so a rank-sensitive comparison is never equal
 * and the dedupe below would never once fire.
 *
 * Field by field rather than by stringifying: `before` comes back through
 * jsonb, which does not preserve key order, so two identical readings can
 * serialise to different strings.
 */
function identicalReading(a: HiscoreSnapshotRow, b: HiscoreSnapshotRow): boolean {
  const skills = new Set([...Object.keys(a.skills), ...Object.keys(b.skills)]);
  for (const skill of skills) {
    const was = a.skills[skill];
    const now = b.skills[skill];
    if (!was || !now) return false;
    if (was.xp !== now.xp || was.level !== now.level) return false;
  }
  const bosses = new Set([...Object.keys(a.bosses), ...Object.keys(b.bosses)]);
  for (const boss of bosses) {
    if (a.bosses[boss]?.kc !== b.bosses[boss]?.kc) return false;
  }
  return true;
}

export type RefreshOutcome =
  /** A snapshot was written. */
  | { status: "refreshed"; delta: HiscoreDelta; milestones: number; snapshot: HiscoreSnapshotRow }
  /** Jagex answered, and the answer was "no such ranked player". */
  | { status: "not_ranked" }
  /** Jagex did not answer. Not the same thing, and not the player's fault. */
  | { status: "unreachable" };

/**
 * Read one account and record what changed.
 *
 * The attempt is stamped on every path. That stamp is what rotates the account
 * to the back of the cron queue, so an account that can never succeed must
 * still be marked — otherwise it blocks the queue forever.
 */
export async function refreshAccountHiscores(input: {
  accountId: string;
  rsn: string;
  source: HiscoreSnapshotSource;
}): Promise<RefreshOutcome> {
  let hiscores: Awaited<ReturnType<typeof fetchHiscores>> = null;
  let reachable = true;
  try {
    hiscores = await fetchHiscores(input.rsn, {
      // strict: a 404 returns null, everything else throws. Without it both
      // outcomes are null and "Jagex is down" is indistinguishable from "this
      // player is not on the hiscores" — one is worth retrying tomorrow and
      // one is worth reporting to the player.
      strict: true,
      signal: AbortSignal.timeout(HISCORE_REFRESH_DEADLINE_MS)
    });
  } catch {
    reachable = false;
  }

  await markHiscoreChecked(input.accountId).catch(() => undefined);

  if (!reachable) return { status: "unreachable" };
  if (!hiscores) return { status: "not_ranked" };

  const after: HiscoreSnapshotRow = {
    takenAt: new Date().toISOString(),
    skills: snapshotSkillsFrom(hiscores.skills),
    bosses: snapshotBossesFrom(hiscores.activities),
    source: input.source
  };

  // Read the previous row BEFORE writing, or the cron's second run in a day
  // updates today's row in place and then compares it against itself.
  const before = await latestHiscoreSnapshot(input.accountId);

  // The daily unique index keeps the cron to one row a day. Nothing bounds the
  // on-demand path, so it dedupes the way sync_snapshot already does: a reading
  // identical to the last one adds nothing to a time series, and a player
  // pressing Refresh between trips would otherwise write a row every ten
  // minutes for a day in which they did not play.
  //
  // The cron is exempt, and that exemption is the whole point. An account
  // nobody is playing reads identically every day, so deduping the cron left a
  // hole in the series exactly as long as the break — and the weekly recap
  // needs a reading from just before the week to describe it. A player who
  // took two weeks off and came back to a huge week got nothing, which is the
  // single case §3.3 exists for. One row a day is what the index already
  // budgets for; a flat row is not noise, it is the evidence that nothing
  // moved.
  const unchanged = input.source !== "cron" && before !== null && identicalReading(before, after);
  if (!unchanged) {
    await recordHiscoreSnapshot({
      accountId: input.accountId,
      skills: after.skills,
      bosses: after.bosses,
      source: input.source
    });
  }

  const delta = hiscoreDelta(before, after);
  const milestones = await recordMilestones(
    input.accountId,
    milestonesFromDelta(before, after, delta)
  );

  return { status: "refreshed", delta, milestones, snapshot: after };
}
