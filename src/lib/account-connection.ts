import { getActiveAccount, linkServerAccount, unlinkServerAccount, type ServerAccountLink } from "./account-storage";
import { clearSavedRsn, saveSavedRsn } from "./saved-bank";

export interface PairingHandle {
  pairingId: string;
  code: string;
  browserSecret: string;
  expiresAt: string;
}

interface AccountResponse {
  ok: boolean;
  connected?: boolean;
  status?: string;
  account?: ServerAccountLink | null;
  pairing?: PairingHandle;
  error?: string;
}

async function readResponse(response: Response): Promise<AccountResponse> {
  const body = await response.json().catch(() => ({})) as AccountResponse;
  if (!response.ok && response.status !== 202) {
    throw new Error(body.error || "Could not connect this browser");
  }
  return body;
}

export async function startBrowserPairing(rsn: string): Promise<PairingHandle> {
  const response = await fetch("/api/account/pair/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rsn }),
    cache: "no-store"
  });
  const body = await readResponse(response);
  if (!body.pairing) throw new Error(body.error || "Could not create a connection code");
  return body.pairing;
}

export async function completeBrowserPairing(handle: PairingHandle): Promise<"pending" | ServerAccountLink> {
  const response = await fetch("/api/account/pair/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pairingId: handle.pairingId, browserSecret: handle.browserSecret }),
    cache: "no-store"
  });
  const body = await readResponse(response);
  if (response.status === 202 || body.status === "pending") return "pending";
  if (!body.account) throw new Error(body.error || "RuneLite did not approve this browser");
  const previousRsn = getActiveAccount()?.rsn ?? null;
  linkServerAccount(body.account, previousRsn);
  saveSavedRsn(body.account.displayName || body.account.rsn);
  return body.account;
}

export async function hydrateConnectedAccount(): Promise<ServerAccountLink | null> {
  const response = await fetch("/api/account/me", { cache: "no-store" });
  const body = await readResponse(response);
  if (!body.connected || !body.account) return null;
  const previousRsn = getActiveAccount()?.rsn ?? null;
  linkServerAccount(body.account, previousRsn);
  saveSavedRsn(body.account.displayName || body.account.rsn);
  return body.account;
}

export async function disconnectConnectedAccount(rsn?: string): Promise<void> {
  await fetch("/api/account/me", { method: "DELETE", cache: "no-store" }).catch(() => null);
  const target = rsn || getActiveAccount()?.rsn;
  if (target) unlinkServerAccount(target);
  if (!getActiveAccount()) clearSavedRsn();
}
