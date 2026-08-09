import { NextResponse } from "next/server";
import { registerAccountVisit } from "@/lib/account-visit-repo";
import { requestHasTrustedOrigin } from "@/lib/account-session-cookie";
import { fetchHiscores } from "@/lib/hiscores";
import { refreshAccountHiscores } from "@/lib/hiscore-refresh";
import { checkAndRecordAttempt, RATE_LIMITS } from "@/lib/rate-attempt";
import { cleanRsnInput } from "@/lib/rsn";

/**
 * "Refresh now" (SPEC §2.3).
 *
 * The daily cron is the backbone, but a player who just finished a trip and
 * opens their page does not want to be told to come back tomorrow. This reads
 * Jagex once, on demand, through the same write path the cron uses.
 *
 * One per RSN per ten minutes. Not per session and not per address: the cost
 * being metered is a request to Jagex for a specific name, so the name is what
 * has to be counted. Keyed per session, ten browsers refresh the same player
 * sixty times an hour; keyed per address, a household shares one budget.
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

  const verdict = await checkAndRecordAttempt(RATE_LIMITS.refreshPerRsn, rsn.toLowerCase());
  if (!verdict.allowed) {
    const minutes = Math.ceil(verdict.retryAfterSeconds / 60);
    return json(
      {
        ok: false,
        error: minutes <= 1
          ? "Already checked. Try again in a minute."
          : `Already checked. Try again in ${minutes} minutes.`,
        retryAfterSeconds: verdict.retryAfterSeconds
      },
      429,
      { "retry-after": String(verdict.retryAfterSeconds) }
    );
  }

  try {
    // The account may not exist yet — a player can reach their page without
    // ever having synced. Registering first is what gives the refresh an
    // account_id to write against, and it is the same verified-on-hiscores
    // path the visit ping uses.
    const hiscores = await fetchHiscores(rsn);
    if (!hiscores) {
      return json({ ok: false, error: "That name is not on the hiscores" }, 404);
    }
    const account = await registerAccountVisit({ rsn, displayName: hiscores.name });
    if (!account) return json({ ok: false, error: "Could not refresh right now" }, 503);

    const outcome = await refreshAccountHiscores({
      accountId: account.accountId,
      rsn,
      source: "manual"
    });

    if (outcome.status === "unreachable") {
      // The hiscores answered a moment ago and not now. Say so plainly rather
      // than reporting a zero week the player would read as "I did nothing".
      return json({ ok: false, error: "The hiscores did not answer. Try again shortly." }, 503);
    }
    if (outcome.status === "not_ranked") {
      return json({ ok: false, error: "That name is not on the hiscores" }, 404);
    }

    return json({
      ok: true,
      // Null when this is the first reading: unknown, which is not zero.
      since: outcome.delta.since,
      xpGained: outcome.delta.xpGained,
      levelsGained: outcome.delta.levelsGained,
      levelUps: outcome.delta.levelUps,
      kcGained: outcome.delta.kcGained,
      moved: outcome.delta.moved,
      milestones: outcome.milestones
    });
  } catch (error) {
    console.error("On-demand refresh failed", {
      name: error instanceof Error ? error.name : "UnknownError"
    });
    return json({ ok: false, error: "Could not refresh right now" }, 500);
  }
}
