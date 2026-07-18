import { NextResponse } from "next/server";
import { deleteAccountHistory } from "@/lib/account-history-repo";
import { getConnectedAccount, revokeBrowserSession } from "@/lib/account-pairing";
import {
  ACCOUNT_SESSION_COOKIE,
  expiredAccountSessionCookieOptions,
  readAccountSessionToken,
  requestHasTrustedOrigin
} from "@/lib/account-session-cookie";

function json(data: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  return NextResponse.json(data, { ...init, headers });
}

export async function DELETE(request: Request): Promise<Response> {
  if (!requestHasTrustedOrigin(request)) {
    return json({ ok: false, error: "Origin not allowed" }, { status: 403 });
  }

  const token = readAccountSessionToken(request);
  if (!token) {
    return json({ ok: false, error: "Connect RuneLite before deleting account history" }, { status: 401 });
  }

  const account = await getConnectedAccount(token);
  if (!account) {
    const response = json({ ok: false, error: "Connected account not found" }, { status: 401 });
    response.cookies.set(ACCOUNT_SESSION_COOKIE, "", expiredAccountSessionCookieOptions());
    return response;
  }

  const deleted = await deleteAccountHistory(account.rsn);
  await revokeBrowserSession(token);

  const response = json({
    ok: true,
    deleted,
    account: {
      rsn: account.rsn,
      displayName: account.displayName
    }
  });
  response.cookies.set(ACCOUNT_SESSION_COOKIE, "", expiredAccountSessionCookieOptions());
  return response;
}
