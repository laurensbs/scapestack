import { NextResponse } from "next/server";
import { defaultRecapDeps, runWeeklyRecap } from "@/lib/weekly-recap-job";

/**
 * The Sunday recap (SPEC §2.3 job 2).
 *
 * Scheduled for Sunday evening: the week it describes is the one ending that
 * day, and the recap lands while a player still has an evening to act on it.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LIMIT = 500;

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Fails closed, like the hiscores job: a route that posts to third-party
  // webhooks on demand must not be callable by anyone who finds the path.
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<Response> {
  if (!authorised(request)) {
    return NextResponse.json({ ok: false, error: "Not authorised" }, {
      status: 401,
      headers: { "cache-control": "no-store" }
    });
  }

  const outcome = await runWeeklyRecap({
    now: new Date(),
    limit: LIMIT,
    candidates: defaultRecapDeps.candidates,
    post: defaultRecapDeps.post
  });

  return NextResponse.json({ ok: true, ...outcome }, { headers: { "cache-control": "no-store" } });
}
