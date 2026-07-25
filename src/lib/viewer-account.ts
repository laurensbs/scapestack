// Who is asking?
//
// Server Components and Server Actions have no Request object, so the existing
// readAccountSessionToken(request) helper does not reach them. This resolves
// the paired browser session from the cookie jar instead, and answers the only
// question the visibility layer needs: which RSN is this browser signed in as?
//
// Null is the normal case, not an error. The plugin opens /next in whatever
// browser is default and that browser is usually unpaired, so most legitimate
// traffic is anonymous. Redaction has to stay usable for those visitors.

import { cookies } from "next/headers";
import { ACCOUNT_SESSION_COOKIE } from "./account-session-cookie";
import { getConnectedAccount } from "./account-pairing";
import { hasDatabase } from "./db";
import { normalizeRsn } from "./rsn";

/** Normalised RSN of the paired browser session, or null when not signed in. */
export async function resolveViewerRsn(): Promise<string | null> {
  if (!hasDatabase()) return null;
  let token: string | undefined;
  try {
    token = (await cookies()).get(ACCOUNT_SESSION_COOKIE)?.value;
  } catch {
    // cookies() throws outside a request scope (e.g. static prerender).
    return null;
  }
  if (!token) return null;
  try {
    const account = await getConnectedAccount(token);
    return account ? normalizeRsn(account.rsn) : null;
  } catch {
    // A session lookup failure must never break the page — it just means the
    // viewer is treated as anonymous, which is the safe direction.
    return null;
  }
}
