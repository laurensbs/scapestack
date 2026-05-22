// Per-RSN bank storage in localStorage. Lets the /u/<rsn> page show
// the bank snapshot that user uploaded, without a database.
//
// Trade-off: data only visible on the same browser/device that uploaded it.
// That's fine for v1 — share URL still works via the /bank/share route.

import { rsnSlug } from "./hiscores";
import type { BankSnapshot } from "./diff";

const BANK_KEY = (rsn: string) => `scapestack:bank:${rsnSlug(rsn)}`;
const CLAIMED_KEY = "scapestack:claimed-rsn";

export function saveBankForRsn(rsn: string, snap: BankSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BANK_KEY(rsn), JSON.stringify(snap));
    // Also remember this RSN locally — used to pre-fill the lookup input.
    localStorage.setItem(CLAIMED_KEY, rsn);
  } catch {}
}

export function loadBankForRsn(rsn: string): BankSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BANK_KEY(rsn));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.items || !parsed.ts) return null;
    return parsed as BankSnapshot;
  } catch {
    return null;
  }
}

export function getClaimedRsn(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CLAIMED_KEY);
  } catch {
    return null;
  }
}

export function setClaimedRsn(rsn: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CLAIMED_KEY, rsn);
  } catch {}
}
