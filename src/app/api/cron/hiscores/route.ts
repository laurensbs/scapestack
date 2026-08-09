import { NextResponse } from "next/server";
import {
  accountsDueForRefresh,
  hiscoreDelta,
  latestHiscoreSnapshot,
  recordHiscoreSnapshot,
  snapshotBossesFrom,
  snapshotSkillsFrom
} from "@/lib/hiscore-snapshot-repo";
import { fetchHiscores } from "@/lib/hiscores";
import { recordMilestones } from "@/lib/milestone-repo";
import { milestonesFromDelta } from "@/lib/milestone-thresholds";
import { PLANNING_SOURCE_DEADLINES_MS } from "@/lib/planning-context";

/**
 * The daily hiscores refresh (SPEC §2.3 job 1).
 *
 * This is the backbone: without a time series there are no "you made progress"
 * moments, no weekly recap and no goal percentage that moves. Everything in
 * Phase 1 that gives a player a reason to come back reads from what this
 * writes.
 *
 * Courtesy to Jagex is a hard requirement, not a nicety — the hiscores are an
 * unmetered public endpoint and the OSRS Wiki's acceptable-use guidance is the
 * house style here. Hence: a batch cap, serial requests with a jittered pause,
 * a per-request deadline, and accounts ordered oldest-read-first so a large
 * roster drains evenly across days instead of hammering in one burst.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Kept under the function's wall clock with room for the final write. */
const BATCH = 40;
const PAUSE_MS = 250;
const JITTER_MS = 250;

function unauthorized(): NextResponse {
  return NextResponse.json({ ok: false, error: "Not authorised" }, {
    status: 401,
    headers: { "cache-control": "no-store" }
  });
}

/**
 * Vercel signs cron invocations with CRON_SECRET as a bearer token. Without
 * the secret configured the route stays shut rather than open — an unguarded
 * endpoint that fans out requests to Jagex on demand is an abuse vector, and
 * "it only runs from the cron" is not a property anyone can verify from the
 * outside.
 */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<Response> {
  if (!authorised(request)) return unauthorized();

  const due = await accountsDueForRefresh(BATCH);
  let refreshed = 0;
  let milestones = 0;
  let unreachable = 0;

  for (const account of due) {
    const hiscores = await fetchHiscores(account.rsn, {
      signal: AbortSignal.timeout(PLANNING_SOURCE_DEADLINES_MS.hiscores)
    }).catch(() => null);
    // A silent Jagex is not a player who stopped playing. Skipping leaves
    // yesterday's row as the newest, so the next run compares against a real
    // reading instead of writing a flat day that would read as "no progress".
    if (!hiscores) {
      unreachable += 1;
      continue;
    }

    const after = {
      takenAt: new Date().toISOString(),
      skills: snapshotSkillsFrom(hiscores.skills),
      bosses: snapshotBossesFrom(hiscores.activities),
      source: "cron" as const
    };
    const before = await latestHiscoreSnapshot(account.accountId);
    await recordHiscoreSnapshot({
      accountId: account.accountId,
      skills: after.skills,
      bosses: after.bosses,
      source: "cron"
    });
    refreshed += 1;

    const delta = hiscoreDelta(before, after);
    milestones += await recordMilestones(account.accountId, milestonesFromDelta(before, after, delta));

    if (PAUSE_MS > 0) {
      await new Promise((resolve) => setTimeout(resolve, PAUSE_MS + Math.random() * JITTER_MS));
    }
  }

  return NextResponse.json(
    { ok: true, due: due.length, refreshed, unreachable, milestones },
    { headers: { "cache-control": "no-store" } }
  );
}
