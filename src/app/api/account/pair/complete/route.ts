import { NextResponse } from "next/server";
import { completeAccountPairing } from "@/lib/account-pairing";
import { ACCOUNT_SESSION_COOKIE, accountSessionCookieOptions } from "@/lib/account-session-cookie";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const { pairingId, browserSecret } = body as { pairingId?: unknown; browserSecret?: unknown };
  if (typeof pairingId !== "string" || typeof browserSecret !== "string") {
    return NextResponse.json({ ok: false, error: "Pairing details are required" }, { status: 400 });
  }
  const result = await completeAccountPairing(pairingId, browserSecret);
  if (result.status === "pending") {
    return NextResponse.json({ ok: true, status: "pending" }, { status: 202, headers: { "cache-control": "no-store" } });
  }
  if (result.status !== "connected") {
    return NextResponse.json({ ok: false, status: result.status, error: "Start a new connection code" }, {
      status: result.status === "expired" ? 410 : 404,
      headers: { "cache-control": "no-store" }
    });
  }
  const response = NextResponse.json({ ok: true, status: "connected", account: result.account }, {
    headers: { "cache-control": "no-store" }
  });
  response.cookies.set(ACCOUNT_SESSION_COOKIE, result.sessionToken, accountSessionCookieOptions(result.expiresAt));
  return response;
}
