import type { HiscoreDelta, HiscoreSnapshotRow } from "./hiscore-snapshot-repo";

/**
 * Which crossings are worth a milestone.
 *
 * SPEC §2.3 job 1 and §4.3. PRINCIPLE 1: every one of these names something
 * that happened in the game. There is no entry here for opening the site,
 * returning, or clicking — and the milestone table's CHECK would reject one
 * anyway, so this file cannot quietly grow a hollow badge.
 *
 * Thresholds are the spec's, not invented: skill 60/70/80/90/99, KC round
 * numbers 25/50/100/250/500/1000.
 */

export const SKILL_MILESTONE_LEVELS = [60, 70, 80, 90, 99] as const;
export const KC_MILESTONE_THRESHOLDS = [25, 50, 100, 250, 500, 1000] as const;

export interface MilestoneCandidate {
  kind: "level" | "kc_threshold";
  payload: Record<string, unknown>;
}

/** Thresholds strictly crossed by going from `from` to `to`. */
function crossed(from: number, to: number, thresholds: readonly number[]): number[] {
  return thresholds.filter((threshold) => from < threshold && to >= threshold);
}

/**
 * A milestone needs a BEFORE. Without an earlier reading there is no crossing —
 * only a player who already had the level when Scapestack first looked, and
 * announcing that as an achievement is the same false positive as reporting an
 * unread boss log as zero KC.
 */
export function milestonesFromDelta(
  before: HiscoreSnapshotRow | null,
  after: HiscoreSnapshotRow,
  delta: HiscoreDelta
): MilestoneCandidate[] {
  if (!before) return [];
  const out: MilestoneCandidate[] = [];

  for (const levelUp of delta.levelUps) {
    for (const level of crossed(levelUp.from, levelUp.to, SKILL_MILESTONE_LEVELS)) {
      out.push({ kind: "level", payload: { skill: levelUp.skill, level } });
    }
  }

  for (const [boss, gained] of Object.entries(delta.kcGained)) {
    const now = after.bosses[boss]?.kc;
    if (!Number.isFinite(now) || gained <= 0) continue;
    for (const threshold of crossed(now - gained, now, KC_MILESTONE_THRESHOLDS)) {
      out.push({ kind: "kc_threshold", payload: { boss, kc: threshold } });
    }
  }

  return out;
}
