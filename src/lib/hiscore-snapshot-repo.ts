import { sql } from "./db";
import type { HiscoreActivity, HiscoreSkill } from "./hiscores";
import { ensureSyncSchema } from "./sync-repo";

/**
 * The time series that gives the product a clock.
 *
 * SPEC §2.3 job 1. Deliberately separate from `sync_snapshot`: that table is
 * plugin-sourced and only exists for players who installed the plugin, while
 * the daily refresh has to work for anyone who has ever entered an RSN. Every
 * "you made progress" moment on the site reads from here.
 *
 * A day with no row is a day the cron did not reach that player, and it must
 * read as unknown rather than as zero progress — the same false-zero the boss
 * KC work already paid for once.
 */

interface QueryClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T[]>;
}

function client(): QueryClient {
  return sql() as unknown as QueryClient;
}

export type HiscoreSnapshotSource = "cron" | "manual" | "plugin";

export interface HiscoreSnapshotSkills {
  [skill: string]: { level: number; xp: number; rank: number };
}

export interface HiscoreSnapshotBosses {
  [boss: string]: { kc: number; rank: number };
}

export interface HiscoreSnapshotRow {
  takenAt: string;
  skills: HiscoreSnapshotSkills;
  bosses: HiscoreSnapshotBosses;
  source: HiscoreSnapshotSource;
}

/**
 * Jagex's summary row. Stored, because the page shows total level and total
 * XP, but never counted as a skill — it is the sum of the others.
 */
const SUMMARY_SKILL = "overall";

/** Unranked reads -1 from Jagex. That is "not on the board", never zero. */
function ranked(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function snapshotSkillsFrom(skills: readonly HiscoreSkill[]): HiscoreSnapshotSkills {
  const out: HiscoreSnapshotSkills = {};
  for (const skill of skills) {
    if (!skill?.name) continue;
    out[skill.name.toLowerCase()] = {
      level: skill.level,
      xp: skill.xp,
      rank: skill.rank
    };
  }
  return out;
}

export function snapshotBossesFrom(activities: readonly HiscoreActivity[]): HiscoreSnapshotBosses {
  const out: HiscoreSnapshotBosses = {};
  for (const activity of activities) {
    if (!activity?.name) continue;
    // An unranked boss is one Scapestack has no reading for. Storing -1 as 0
    // would later read as "killed it zero times", which is a claim the
    // hiscores never made.
    if (!ranked(activity.score)) continue;
    out[activity.name.toLowerCase()] = { kc: activity.score, rank: activity.rank };
  }
  return out;
}

/**
 * One cron row per account per day (enforced by a partial unique index).
 * A same-day repeat is not an error — it is the cron running twice — so it
 * updates in place rather than raising.
 */
export async function recordHiscoreSnapshot(input: {
  accountId: string;
  skills: HiscoreSnapshotSkills;
  bosses: HiscoreSnapshotBosses;
  source: HiscoreSnapshotSource;
}): Promise<void> {
  await ensureSyncSchema();
  if (input.source === "cron") {
    await client().query(`
      INSERT INTO hiscore_snapshot (account_id, skills, bosses, source)
      VALUES ($1::uuid, $2::jsonb, $3::jsonb, 'cron')
      ON CONFLICT (account_id, ((taken_at AT TIME ZONE 'UTC')::date)) WHERE source = 'cron'
      DO UPDATE SET skills = EXCLUDED.skills, bosses = EXCLUDED.bosses, taken_at = NOW()
    `, [input.accountId, JSON.stringify(input.skills), JSON.stringify(input.bosses)]);
    return;
  }
  await client().query(`
    INSERT INTO hiscore_snapshot (account_id, skills, bosses, source)
    VALUES ($1::uuid, $2::jsonb, $3::jsonb, $4)
  `, [input.accountId, JSON.stringify(input.skills), JSON.stringify(input.bosses), input.source]);
}

export async function latestHiscoreSnapshot(accountId: string): Promise<HiscoreSnapshotRow | null> {
  await ensureSyncSchema();
  const rows = await client().query<{
    taken_at: string; skills: unknown; bosses: unknown; source: string;
  }>(`
    SELECT taken_at, skills, bosses, source
    FROM hiscore_snapshot
    WHERE account_id = $1::uuid
    ORDER BY taken_at DESC
    LIMIT 1
  `, [accountId]);
  const row = rows[0];
  if (!row) return null;
  return {
    takenAt: new Date(row.taken_at).toISOString(),
    skills: (row.skills ?? {}) as HiscoreSnapshotSkills,
    bosses: (row.bosses ?? {}) as HiscoreSnapshotBosses,
    source: row.source as HiscoreSnapshotSource
  };
}

/** The newest snapshot at or before `before`, for a since-then comparison. */
export async function hiscoreSnapshotBefore(accountId: string, before: Date): Promise<HiscoreSnapshotRow | null> {
  await ensureSyncSchema();
  const rows = await client().query<{
    taken_at: string; skills: unknown; bosses: unknown; source: string;
  }>(`
    SELECT taken_at, skills, bosses, source
    FROM hiscore_snapshot
    WHERE account_id = $1::uuid AND taken_at <= $2::timestamptz
    ORDER BY taken_at DESC
    LIMIT 1
  `, [accountId, before.toISOString()]);
  const row = rows[0];
  if (!row) return null;
  return {
    takenAt: new Date(row.taken_at).toISOString(),
    skills: (row.skills ?? {}) as HiscoreSnapshotSkills,
    bosses: (row.bosses ?? {}) as HiscoreSnapshotBosses,
    source: row.source as HiscoreSnapshotSource
  };
}

export interface HiscoreDelta {
  /** Null when there is no earlier snapshot: unknown, which is not zero. */
  since: string | null;
  xpGained: number;
  levelsGained: number;
  levelUps: Array<{ skill: string; from: number; to: number }>;
  kcGained: Record<string, number>;
  /** True when something moved. Drives §5.1's weekly qualification. */
  moved: boolean;
}

/**
 * What changed between two readings.
 *
 * Only counts a skill or boss present in BOTH snapshots. A metric that appears
 * for the first time is a player crossing onto the hiscores, not a gain of its
 * whole value — counting it would report a 13M XP week for someone who just
 * got ranked.
 */
export function hiscoreDelta(
  before: HiscoreSnapshotRow | null,
  after: HiscoreSnapshotRow
): HiscoreDelta {
  if (!before) {
    return { since: null, xpGained: 0, levelsGained: 0, levelUps: [], kcGained: {}, moved: false };
  }
  let xpGained = 0;
  let levelsGained = 0;
  const levelUps: HiscoreDelta["levelUps"] = [];
  for (const [skill, now] of Object.entries(after.skills)) {
    // "Overall" is Jagex's own sum of the other rows, not a skill. Counting it
    // alongside them doubles every XP and level a week ever reports — a 1.2M
    // week is announced as 2.4M — and there is no reading of the data from
    // which that number is true.
    if (skill === SUMMARY_SKILL) continue;
    const was = before.skills[skill];
    if (!was) continue;
    if (Number.isFinite(now.xp) && Number.isFinite(was.xp) && now.xp > was.xp) {
      xpGained += now.xp - was.xp;
    }
    if (Number.isFinite(now.level) && Number.isFinite(was.level) && now.level > was.level) {
      levelsGained += now.level - was.level;
      levelUps.push({ skill, from: was.level, to: now.level });
    }
  }
  const kcGained: Record<string, number> = {};
  for (const [boss, now] of Object.entries(after.bosses)) {
    const was = before.bosses[boss];
    if (!was) continue;
    if (now.kc > was.kc) kcGained[boss] = now.kc - was.kc;
  }
  return {
    since: before.takenAt,
    xpGained,
    levelsGained,
    levelUps,
    kcGained,
    moved: xpGained > 0 || levelsGained > 0 || Object.keys(kcGained).length > 0
  };
}

/**
 * Accounts the daily refresh should read, longest-unattempted first.
 *
 * Ordered by the ATTEMPT, not by the last successful snapshot. A name that is
 * not on the hiscores never produces a snapshot, so under a success-ordered
 * queue it stays at the head forever and takes a slot in every batch — and
 * once there are more such names than the batch holds, no ranked player is ever
 * refreshed again. The queue has to drain, and only the attempt drains it.
 */
export async function accountsDueForRefresh(limit: number): Promise<Array<{ accountId: string; rsn: string }>> {
  await ensureSyncSchema();
  const rows = await client().query<{ account_id: string; rsn: string }>(`
    SELECT i.account_id, i.rsn
    FROM account_identity i
    WHERE i.deletion_requested_at IS NULL
      AND (i.hiscore_checked_at IS NULL OR i.hiscore_checked_at < NOW() - INTERVAL '20 hours')
    ORDER BY i.hiscore_checked_at ASC NULLS FIRST, i.last_seen_at DESC
    LIMIT $1
  `, [limit]);
  return rows.map((row) => ({ accountId: row.account_id, rsn: row.rsn }));
}

/**
 * Stamp the attempt, whatever came of it.
 *
 * Called on every outcome — snapshot written, Jagex silent, player not ranked —
 * because this is what moves the account to the back of the queue. Recording it
 * only on success is precisely the bug the ordering above exists to avoid.
 */
export async function markHiscoreChecked(accountId: string): Promise<void> {
  await ensureSyncSchema();
  await client().query(
    `UPDATE account_identity SET hiscore_checked_at = NOW() WHERE account_id = $1::uuid`,
    [accountId]
  );
}
