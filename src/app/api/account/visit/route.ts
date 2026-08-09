import { NextResponse } from "next/server";
import { recordVisitForKnownAccount, registerAccountVisit } from "@/lib/account-visit-repo";
import { requestHasTrustedOrigin } from "@/lib/account-session-cookie";
import { clientAddressFrom } from "@/lib/claim-rate-limit";
import { fetchHiscores } from "@/lib/hiscores";
import { checkAndRecordAttempt, RATE_LIMITS } from "@/lib/rate-attempt";
import { cleanRsnInput } from "@/lib/rsn";

/**
 * "This player was looked at today."
 *
 * Two things depend on it, both from Phase 1:
 *
 * - The daily cron iterates `account_identity`, and that table was only ever
 *   written by a plugin sync or a claim. A player who just types an RSN had no
 *   row, so the backbone that exists specifically to serve RSN-only players had
 *   no RSN-only players to serve.
 * - §7 D1/D7 return needs one row per account per day.
 *
 * Called after paint rather than during render: a write in the render path
 * costs every visitor time-to-first-byte for a number only we read, and a
 * client that never runs the script is a crawler, which should not be in the
 * return metric anyway.
 */

const NO_STORE = { "cache-control": "no-store" };

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

export async function POST(request: Request): Promise<Response> {
  if (!requestHasTrustedOrigin(request)) {
    return json({ ok: false, error: "That request did not come from this site" }, 403);
  }

  let rsn = "";
  try {
    const body = await request.json() as { rsn?: unknown };
    rsn = typeof body.rsn === "string" ? cleanRsnInput(body.rsn).slice(0, 12) : "";
  } catch {
    return json({ ok: false, error: "That name is not valid" }, 400);
  }
  if (!rsn) return json({ ok: false, error: "That name is not valid" }, 400);

  try {
    // A name already in the roster passed the hiscores check when it got
    // there. Re-verifying on every page view would put a request to Jagex
    // behind every returning player — and the returning player is the case
    // this whole item exists to serve.
    const known = await recordVisitForKnownAccount(rsn);
    if (known) return json({ ok: true, registered: false });
  } catch (error) {
    console.error("Visit record failed", {
      name: error instanceof Error ? error.name : "UnknownError"
    });
    return json({ ok: false, error: "Could not record that visit" }, 500);
  }

  // Only a name Scapestack has never seen reaches Jagex, and only that path
  // is metered — the limit is on growing the roster, not on visiting.
  const verdict = await checkAndRecordAttempt(RATE_LIMITS.registerPerAddress, clientAddressFrom(request));
  if (!verdict.allowed) {
    return json({ ok: false, error: "Slow down a moment" }, 429, {
      "retry-after": String(verdict.retryAfterSeconds)
    });
  }

  try {
    // Confirm against the hiscores before creating an identity. A row here is
    // what puts a name into the cron's roster, and a roster that accepts
    // unverified strings is a way to make Scapestack fetch anything from Jagex
    // on a schedule. The page rendering this has just read the same URL, so in
    // practice this is a Data Cache hit rather than a second round trip.
    const hiscores = await fetchHiscores(rsn);
    if (!hiscores) return json({ ok: true, registered: false, reason: "not_ranked" });

    const visit = await registerAccountVisit({ rsn, displayName: hiscores.name });
    return json({ ok: true, registered: Boolean(visit) });
  } catch (error) {
    // Never surfaced to the player. A visit that failed to record is a hole in
    // a metric, not a broken page, and the page has already rendered.
    console.error("Visit registration failed", {
      name: error instanceof Error ? error.name : "UnknownError"
    });
    return json({ ok: false, error: "Could not record that visit" }, 500);
  }
}
