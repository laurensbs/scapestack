import { NextResponse } from "next/server";
import { getConnectedAccount, revokeBrowserSession } from "@/lib/account-pairing";
import {
  ACCOUNT_SESSION_COOKIE,
  expiredAccountSessionCookieOptions,
  readAccountSessionToken
} from "@/lib/account-session-cookie";

export async function GET(request: Request): Promise<Response> {
  const token = readAccountSessionToken(request);
  const account = token ? await getConnectedAccount(token) : null;
  return NextResponse.json({ ok: true, connected: Boolean(account), account }, {
    headers: { "cache-control": "no-store" }
  });
}

export async function DELETE(request: Request): Promise<Response> {
  const token = readAccountSessionToken(request);
  if (token) await revokeBrowserSession(token);
  const response = NextResponse.json({ ok: true, connected: false }, {
    headers: { "cache-control": "no-store" }
  });
  response.cookies.set(ACCOUNT_SESSION_COOKIE, "", expiredAccountSessionCookieOptions());
  return response;
}
