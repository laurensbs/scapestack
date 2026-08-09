import { BOSSES } from "./bosses";
import { hiscoreDelta, type HiscoreSnapshotRow } from "./hiscore-snapshot-repo";
import { pinnedGoalProgress, type PinnedGoal, type PinnedGoalProgressEvidence } from "./pinned-goals";
import { XP_TABLE } from "./skill-methods/types";
import { compactXp, type RecapGoalProgress, type RecapWeek } from "./weekly-recap";

/**
 * Turning two hiscore readings into the week a player actually had.
 *
 * Kept apart from delivery so every rule here can be tested against fixed
 * snapshots: which pair of readings counts as "this week", when a week is too
 * stale to describe, and how much of a goal is left in the goal's own units.
 */

/**
 * How far before the week began a baseline reading may be taken.
 *
 * The cron reads daily, so a baseline from Sunday evening for a Monday week is
 * normal and one from three weeks ago is not. Without this the delta would
 * still compute — and the message would say "this week" over a month of
 * progress, which is the kind of wrong that a player notices immediately and
 * never trusts again.
 */
const BASELINE_MAX_LEAD_DAYS = 4;

/** How stale the closing reading may be before the week is not worth describing. */
const CLOSING_MAX_AGE_DAYS = 3;

const DAY_MS = 86_400_000;

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / DAY_MS;
}

export type WeekSkipReason = "no-baseline" | "baseline-too-old" | "closing-too-old" | "nothing-happened";

export interface BuiltWeek {
  week: RecapWeek | null;
  skipped: WeekSkipReason | null;
}

const BOSS_SLUG_BY_NAME = new Map(BOSSES.map((boss) => [boss.name.toLowerCase(), boss.slug] as const));

/**
 * A snapshot, in the shape the goal engine reads.
 *
 * Only skills and boss KC: a hiscore reading carries nothing else. Goals that
 * need RuneLite — collection log, quests, diaries, combat achievements — come
 * back with a null percentage rather than a zero, and the recap then leaves the
 * goal clause out entirely. Saying "0% to your 1,000 log slots" to a player at
 * 812 is worse than saying nothing.
 */
export function snapshotEvidence(
  row: HiscoreSnapshotRow,
  clogSlots?: number | null
): PinnedGoalProgressEvidence {
  const bossKc: Record<string, number> = {};
  for (const [name, entry] of Object.entries(row.bosses)) {
    const slug = BOSS_SLUG_BY_NAME.get(name.toLowerCase());
    if (slug) bossKc[slug] = entry.kc;
  }
  return {
    skills: Object.entries(row.skills).map(([name, entry]) => ({
      name,
      level: entry.level,
      xp: entry.xp
    })),
    bossKc,
    // Folded in when a RuneLite sync supplied it. Left undefined otherwise,
    // which the goal engine reads as unknown rather than as zero.
    ...(typeof clogSlots === "number" ? { clogSlots } : {})
  };
}

/**
 * What is left, counted in the goal's own units (§3.1).
 *
 * "1.2M XP left" and "312 KC to go" are things a player can plan a session
 * around; "18% remaining" is not. Returns null when the metric was not read,
 * because an unread metric supports no claim about the remainder.
 */
export function goalRemainder(goal: PinnedGoal, evidence: PinnedGoalProgressEvidence): string | null {
  if (goal.kind === "level") {
    const skill = evidence.skills.find((row) => row.name.toLowerCase() === goal.skill.toLowerCase());
    const target = XP_TABLE[goal.targetLevel];
    if (!skill || typeof skill.xp !== "number" || !Number.isFinite(target)) return null;
    const left = target - skill.xp;
    return left > 0 ? `${compactXp(left)} XP` : null;
  }
  if (goal.kind === "skill_xp") {
    const skill = evidence.skills.find((row) => row.name.toLowerCase() === goal.skill.toLowerCase());
    if (!skill || typeof skill.xp !== "number") return null;
    const left = goal.targetXp - skill.xp;
    return left > 0 ? `${compactXp(left)} XP` : null;
  }
  if (goal.kind === "boss_kc") {
    const kc = evidence.bossKc?.[goal.bossSlug];
    if (typeof kc !== "number") return null;
    const left = goal.targetKc - kc;
    return left > 0 ? `${left} ${goal.bossName} KC` : null;
  }
  if (goal.kind === "clog_slots") {
    if (typeof evidence.clogSlots !== "number") return null;
    const left = goal.targetSlots - evidence.clogSlots;
    return left > 0 ? `${left} slots` : null;
  }
  return null;
}

/**
 * The goal clause, or nothing.
 *
 * Both percentages must be readable: a goal that could not be measured at the
 * start of the week has no "you were 74%, now 82%" to report, and inventing the
 * first half of that sentence is how a recap starts lying.
 */
export function recapGoalProgress(
  goal: PinnedGoal,
  before: PinnedGoalProgressEvidence,
  after: PinnedGoalProgressEvidence
): RecapGoalProgress | null {
  const start = pinnedGoalProgress(goal, before);
  const end = pinnedGoalProgress(goal, after);
  if (start.percent === null || end.percent === null) return null;
  return {
    target: goal.target,
    pctBefore: start.percent,
    pctAfter: end.percent,
    remainder: goalRemainder(goal, after)
  };
}

export interface BuildWeekInput {
  rsn: string;
  weekStart: string;
  /** Newest reading strictly before the week began. */
  baseline: HiscoreSnapshotRow | null;
  /** Newest reading overall. */
  closing: HiscoreSnapshotRow | null;
  goal: PinnedGoal | null;
  nextStepUrl: string;
  /**
   * Collection-log slot counts either side of the week, from RuneLite syncs.
   * Null for a hiscores-only account — which is not zero, and the difference
   * decides whether the recap may claim anything about the log at all.
   */
  clogBefore?: number | null;
  clogAfter?: number | null;
  /** Injected rather than read from the clock, so a week is reproducible. */
  now: Date;
}

/**
 * Build the week, or say why there isn't one.
 *
 * Every skip is named. A recap job that silently produces nothing is
 * indistinguishable from one that is broken, and this ran for a week before
 * anyone would notice the difference.
 */
export function buildRecapWeek(input: BuildWeekInput): BuiltWeek {
  if (!input.baseline || !input.closing) return { week: null, skipped: "no-baseline" };

  const weekStartDate = new Date(`${input.weekStart}T00:00:00.000Z`);
  const baselineAt = new Date(input.baseline.takenAt);
  const closingAt = new Date(input.closing.takenAt);

  if (daysBetween(baselineAt, weekStartDate) > BASELINE_MAX_LEAD_DAYS) {
    return { week: null, skipped: "baseline-too-old" };
  }
  if (daysBetween(closingAt, input.now) > CLOSING_MAX_AGE_DAYS) {
    return { week: null, skipped: "closing-too-old" };
  }

  const delta = hiscoreDelta(input.baseline, input.closing);
  const goal = input.goal
    ? recapGoalProgress(
        input.goal,
        snapshotEvidence(input.baseline, input.clogBefore),
        snapshotEvidence(input.closing, input.clogAfter)
      )
    : null;

  // Both counts or neither. One reading and a missing one is a difference
  // against nothing, and it would report a player's entire collection log as
  // this week's haul on the first sync after they installed the plugin.
  const clogSlotsGained = typeof input.clogBefore === "number" && typeof input.clogAfter === "number"
    ? Math.max(0, input.clogAfter - input.clogBefore)
    : 0;

  return {
    week: {
      rsn: input.rsn,
      weekStart: input.weekStart,
      xpGained: delta.xpGained,
      levelsGained: delta.levelsGained,
      levelUps: delta.levelUps,
      kcGained: delta.kcGained,
      clogSlotsGained,
      goal,
      nextStepUrl: input.nextStepUrl
    },
    skipped: null
  };
}
