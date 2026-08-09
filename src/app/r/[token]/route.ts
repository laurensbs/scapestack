import { NextResponse } from "next/server";
import { recordRecapClick } from "@/lib/weekly-recap-repo";

/**
 * The recap link (SPEC §7: recap CTR).
 *
 * Every recap links here rather than straight at the player's page, so the
 * click is recorded server-side before the redirect. A client-side event could
 * not answer this: Discord fetches link previews, blockers eat beacons, and the
 * number decides whether Phase 3 gets built at all.
 *
 * A token that does not resolve still lands somewhere useful — the home page,
 * not a 404. The player clicked a link Scapestack sent them; being shown an
 * error because a row was deleted is Scapestack's problem, not theirs.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
): Promise<Response> {
  const { token } = await context.params;
  const click = await recordRecapClick(token).catch(() => null);
  const target = click ? `/p/${encodeURIComponent(click.rsn)}?from=recap` : "/";
  return NextResponse.redirect(new URL(target, "https://www.scapestack.org"), {
    status: 302,
    headers: { "cache-control": "no-store" }
  });
}
