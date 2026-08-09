import { NextResponse } from "next/server";
import { accountsDueForRefresh } from "@/lib/hiscore-snapshot-repo";
import { HISCORE_REFRESH_DEADLINE_MS, refreshAccountHiscores } from "@/lib/hiscore-refresh";

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
 * house style here. Hence: serial requests with a jittered pause, a
 * per-request deadline, and accounts ordered longest-unattempted first so a
 * large roster drains evenly across days instead of hammering in one burst.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The batch is bounded by the clock, not by a count.
 *
 * A count cannot be: the work per account is a network round trip to someone
 * else's server, so BATCH × deadline is the worst case and any count large
 * enough to be useful is also large enough to overrun the function. The
 * previous shape — 40 accounts, no wall-clock check — held together only
 * because the per-request deadline was 900ms; at a realistic deadline it runs
 * for five minutes and is killed mid-write.
 *
 * So: take a generous queue, and stop when the time is gone. Whatever is left
 * is still at the head of the queue tomorrow.
 */
const QUEUE = 400;
const BUDGET_MS = 240_000;
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

  const startedAt = Date.now();
  const due = await accountsDueForRefresh(QUEUE);
  let attempted = 0;
  let refreshed = 0;
  let milestones = 0;
  let unreachable = 0;
  let notRanked = 0;

  for (const account of due) {
    // Leave room for one more full request plus its write before the function
    // is killed. Stopping early is normal: the queue is ordered, so the
    // accounts not reached today are the first ones reached tomorrow.
    if (Date.now() - startedAt > BUDGET_MS - HISCORE_REFRESH_DEADLINE_MS) break;

    attempted += 1;
    const outcome = await refreshAccountHiscores({
      accountId: account.accountId,
      rsn: account.rsn,
      source: "cron"
    });

    if (outcome.status === "refreshed") {
      refreshed += 1;
      milestones += outcome.milestones;
    } else if (outcome.status === "not_ranked") {
      // Jagex answered: this name is not on the hiscores. Counted apart from a
      // failure because it is not one — it is a real answer about a player too
      // low to be ranked, and folding the two together would hide an outage
      // inside a number that looks normal.
      notRanked += 1;
    } else {
      // A silent Jagex is not a player who stopped playing. No snapshot is
      // written, so the next run compares against a real reading instead of a
      // flat day that would read as "no progress".
      unreachable += 1;
    }

    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS + Math.random() * JITTER_MS));
  }

  return NextResponse.json(
    {
      ok: true,
      due: due.length,
      attempted,
      remaining: due.length - attempted,
      refreshed,
      notRanked,
      unreachable,
      milestones,
      elapsedMs: Date.now() - startedAt
    },
    { headers: { "cache-control": "no-store" } }
  );
}
