import { NextResponse } from "next/server";
import { getConnectedAccount } from "@/lib/account-pairing";
import { readAccountSessionToken } from "@/lib/account-session-cookie";
import {
  getAccountTimeline,
  importLegacyTripEvents,
  validTimelineCursor
} from "@/lib/account-timeline-repo";

function unauthorized(): Response {
  return NextResponse.json({ ok: false, error: "Connect RuneLite to see your progress here" }, {
    status: 401,
    headers: { "cache-control": "no-store" }
  });
}

async function accountFor(request: Request) {
  const token = readAccountSessionToken(request);
  return token ? getConnectedAccount(token) : null;
}

export async function GET(request: Request): Promise<Response> {
  const account = await accountFor(request);
  if (!account) return unauthorized();
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  if (!validTimelineCursor(cursor)) {
    return NextResponse.json({ ok: false, error: "That page link is no longer valid" }, { status: 400 });
  }
  const requestedLimit = Number(url.searchParams.get("limit") ?? 8);
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 8;
  try {
    const page = await getAccountTimeline(account.accountId, { cursor, limit });
    return NextResponse.json({
      ok: true,
      account: { rsn: account.rsn, displayName: account.displayName },
      ...page
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Account timeline load failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown failure"
    });
    return NextResponse.json(
      { ok: false, error: "Could not load your recent progress" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const account = await accountFor(request);
  if (!account) return unauthorized();
  let body: { events?: unknown };
  try {
    body = await request.json() as { events?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Could not read those trips" }, { status: 400 });
  }
  try {
    const result = await importLegacyTripEvents(account.accountId, account.rsn, body.events);
    return NextResponse.json({ ok: true, ...result }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Account timeline import failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown failure"
    });
    return NextResponse.json(
      { ok: false, error: "Could not save those trips" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
