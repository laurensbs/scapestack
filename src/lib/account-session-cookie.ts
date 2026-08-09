export const ACCOUNT_SESSION_COOKIE = "scapestack_account";

export function readAccountSessionToken(request: Request): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === ACCOUNT_SESSION_COOKIE) {
      // decodeURIComponent throws URIError on a malformed escape — a lone "%"
      // is enough. Uncaught, that turned every account route into a 500, and
      // the 401 branch that clears the bad cookie was never reached: a player
      // with a corrupted cookie was locked out of their own account area with
      // no way back from inside the site. An unreadable cookie is no session.
      let value: string;
      try {
        value = decodeURIComponent(rawValue.join("="));
      } catch {
        return null;
      }
      return value || null;
    }
  }
  return null;
}

export function accountSessionCookieOptions(expiresAt: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt)
  };
}

export function expiredAccountSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
    maxAge: 0
  };
}

export function requestHasTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("host");
  if (!host) return false;
  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}
