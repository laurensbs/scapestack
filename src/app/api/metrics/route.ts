import { NextResponse } from "next/server";
import { specMetrics } from "@/lib/spec-metrics";

/**
 * The §7 gates, on one page.
 *
 * Behind CRON_SECRET, not because the numbers are secret but because they are
 * aggregates over a user base small enough that "3 of 4 clicked" is close to
 * naming people. Same door as the crons; there is no second secret to lose.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Not authorised" }, {
      status: 401,
      headers: { "cache-control": "no-store" }
    });
  }
  const metrics = await specMetrics(new Date());
  return NextResponse.json({ ok: true, ...metrics }, { headers: { "cache-control": "no-store" } });
}
