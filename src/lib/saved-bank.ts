// "Save my bank" — Fase 5 retentie-fix. A returning player shouldn't have to
// dig up their RuneLite Bank Tags export every visit. We persist the raw
// banktags string in localStorage and re-hydrate it on the next page load.
//
// Design lives in docs/SAVE-BANK-DESIGN.md. The short of it:
//  - Storage: localStorage only — STRATEGY.md ruled out accounts/server state.
//  - Payload: the raw banktags string + a timestamp. The OrganizeResult is
//    *derived*, so we never cache it — engine improvements should reach
//    returning users automatically.
//  - One slot, not many. We solve 80% of cases with one current bank.
//  - RSN is a separate "remember me" key — bank-save and RSN-save are
//    orthogonal features.
//  - A session-scoped "disabled" flag lets users opt out on shared devices.
//
// All functions are safe to call on the server (SSR) — they no-op on
// missing window, never throw on parse failures.

import { ACCOUNT_EVENT, accountIdForRsn, getActiveAccount, loadAccountStore, markAccountBankSaved, upsertAccount } from "./account-storage";

const BANK_KEY = "scapestack:saved-bank:v1";
const ACCOUNT_BANK_KEY = (rsn: string) => `scapestack:saved-bank:${accountIdForRsn(rsn)}:v1`;
const RSN_KEY = "scapestack:saved-rsn:v1";
const DISABLED_SESSION_KEY = "scapestack:save-bank:disabled";
export const SAVED_BANK_EVENT = "scapestack:saved-bank-change";

export interface SavedBank {
  /** Schema version — bump only if the payload shape changes. */
  version: 1;
  /** The raw banktags string the user pasted. Source-of-truth, not the
   *  derived OrganizeResult. */
  banktags: string;
  /** Epoch ms when the bank was saved. Used for the "from X ago" badge. */
  savedAt: number;
}

function notifySavedBankChange(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(SAVED_BANK_EVENT));
  } catch {
  }
}

function notifySavedRsnChange(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(ACCOUNT_EVENT));
  } catch {
  }
}

// ── Bank ─────────────────────────────────────────────────────────────

/** True when the user has opted out of saving on this device for the
 *  current session. Resets when the tab/window closes (sessionStorage). */
export function isSaveBankDisabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(DISABLED_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

/** Mark this session as "don't save here." Also clears any existing
 *  saved bank — that's the whole point of choosing this on a shared
 *  device. */
export function disableSaveBankForSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(DISABLED_SESSION_KEY, "1");
  } catch { /* private mode etc. — disabled flag is best-effort */ }
  clearSavedBank();
}

/** Load the most recent saved bank, or null if there isn't one /
 *  storage is unreadable / the payload is corrupt. Never throws.
 *  Corrupt payloads are wiped so we don't trip over them on every load. */
export function loadSavedBank(rsn?: string | null): SavedBank | null {
  if (typeof window === "undefined") return null;
  const cleanRsn = (rsn ?? "").trim();
  if (cleanRsn) {
    const accountBank = loadSavedBankFromKey(ACCOUNT_BANK_KEY(cleanRsn));
    if (accountBank) return accountBank;
    if (!shouldUseLegacyBankFallback(cleanRsn)) return null;
  }
  return loadSavedBankFromKey(BANK_KEY);
}

function loadSavedBankFromKey(key: string): SavedBank | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch { return null; }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Malformed JSON — clean the slot and bail.
    try { localStorage.removeItem(key); } catch {}
    return null;
  }
  if (!isValidSavedBank(parsed)) {
    try { localStorage.removeItem(key); } catch {}
    return null;
  }
  return parsed;
}

function shouldUseLegacyBankFallback(rsn: string): boolean {
  const store = loadAccountStore();
  if (store.accounts.length <= 1) return true;
  return store.accounts.some((account) => account.rsn === rsn && account.bankSavedAt);
}

/** Save the bank. No-op when the user has disabled saving for this
 *  session; that keeps shared-device hygiene predictable. */
export function saveSavedBank(banktags: string, rsn?: string | null): void {
  if (typeof window === "undefined") return;
  if (isSaveBankDisabled()) return;
  const trimmed = banktags.trim();
  if (!trimmed) return; // never persist an empty paste
  const payload: SavedBank = { version: 1, banktags: trimmed, savedAt: Date.now() };
  const cleanRsn = (rsn ?? getActiveAccount()?.rsn ?? "").trim();
  try {
    localStorage.setItem(BANK_KEY, JSON.stringify(payload));
    if (cleanRsn) {
      localStorage.setItem(ACCOUNT_BANK_KEY(cleanRsn), JSON.stringify(payload));
      markAccountBankSaved(cleanRsn, payload.savedAt);
    }
    notifySavedBankChange();
  } catch { /* quota exceeded / private mode — silently skip */ }
}

/** Drop the saved bank. Safe to call when nothing is saved. */
export function clearSavedBank(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(BANK_KEY); } catch {}
  notifySavedBankChange();
}

// ── RSN ─────────────────────────────────────────────────────────────

export function loadSavedRsn(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(RSN_KEY);
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

export function saveSavedRsn(rsn: string): void {
  if (typeof window === "undefined") return;
  if (isSaveBankDisabled()) return; // the same opt-out covers RSN
  const trimmed = rsn.trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(RSN_KEY, trimmed);
    upsertAccount(trimmed);
  } catch {}
}

export function clearSavedRsn(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(RSN_KEY); } catch {}
  notifySavedRsnChange();
}

// ── Internals ───────────────────────────────────────────────────────

function isValidSavedBank(x: unknown): x is SavedBank {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return o.version === 1
    && typeof o.banktags === "string"
    && o.banktags.length > 0
    && typeof o.savedAt === "number"
    && Number.isFinite(o.savedAt);
}

// Iconic OSRS megararities — the items players light up for. We use them
// to detect "you actually got a purple since last visit" when a returning
// player pastes a fresh bank. List is intentionally small and hand-curated;
// over-counting (Bandos chestplate every visit) would dilute the moment.
//
// Substring-matched (case-insensitive) against banktags item names. Each
// entry: { needle, displayName, iconItemId } so the celebration banner
// can render the sprite without a second lookup.
export interface IconicItem {
  needle: string;       // lowercased substring match
  displayName: string;  // shown in the banner
  iconItemId: number;   // OSRS item id for the sprite
}

export const ICONIC_ITEMS: IconicItem[] = [
  // Raids megararities
  { needle: "twisted bow",        displayName: "Twisted bow",        iconItemId: 20997 },
  { needle: "scythe of vitur",    displayName: "Scythe of vitur",    iconItemId: 22325 },
  { needle: "ghrazi rapier",      displayName: "Ghrazi rapier",      iconItemId: 22324 },
  { needle: "sanguinesti staff",  displayName: "Sanguinesti staff",  iconItemId: 22323 },
  { needle: "justiciar",          displayName: "Justiciar set",      iconItemId: 22327 },
  { needle: "tumeken's shadow",   displayName: "Tumeken's shadow",   iconItemId: 27275 },
  { needle: "elidinis' ward",     displayName: "Elidinis' ward",     iconItemId: 25985 },
  { needle: "osmumten's fang",    displayName: "Osmumten's fang",    iconItemId: 26219 },
  { needle: "lightbearer",        displayName: "Lightbearer",        iconItemId: 25975 },
  { needle: "masori",             displayName: "Masori set",         iconItemId: 27229 },
  { needle: "kodai insignia",     displayName: "Kodai insignia",     iconItemId: 21043 },
  { needle: "elder maul",         displayName: "Elder maul",         iconItemId: 21003 },
  // DT2 + Nex
  { needle: "soulreaper axe",     displayName: "Soulreaper axe",     iconItemId: 28997 },
  { needle: "torva",              displayName: "Torva set",          iconItemId: 26384 },
  { needle: "zaryte crossbow",    displayName: "Zaryte crossbow",    iconItemId: 26374 },
  // Solo-boss signatures
  { needle: "bow of faerdhinen",  displayName: "Bow of Faerdhinen",  iconItemId: 25865 },
  { needle: "blowpipe",           displayName: "Toxic blowpipe",     iconItemId: 12924 }
];

/** Lowercased item names from a raw Bank Memory paste. Bank Tags strings are
 *  id-only, so they intentionally do not trigger drop celebrations. */
function namesFromBanktags(banktags: string): string[] {
  const out: string[] = [];
  for (const rawLine of banktags.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // RuneLite Bank Memory canonical format:
    //   Item id <tab> Item name <tab> Item quantity
    // Older tests and some copied tables use:
    //   Item name <tab> quantity
    // Support both, but never infer names from Bank Tags id-only strings.
    if (!line.includes("\t")) continue;
    const cells = line.split("\t");
    const first = cells[0]?.trim() ?? "";
    const second = cells[1]?.trim() ?? "";
    if (/^item id$/i.test(first) || /^item name$/i.test(first)) continue;
    const name = /^\d+$/.test(first) ? second : first;
    if (name) {
      out.push(name.toLowerCase());
    }
  }
  return out;
}

/** Returns iconic items present in the new paste but absent from the
 *  previous one. Used to drive the drop-celebration banner. When the
 *  previous paste isn't available (first visit) we return an empty array
 *  — celebrations only fire on the second+ paste, never as a "welcome,
 *  here's your bank" moment that the player didn't ask for. */
export function diffIconicItems(prevBanktags: string, nextBanktags: string): IconicItem[] {
  if (!prevBanktags || !nextBanktags) return [];
  const prev = namesFromBanktags(prevBanktags);
  const next = namesFromBanktags(nextBanktags);
  if (prev.length === 0 || next.length === 0) return [];
  const has = (names: string[], needle: string) => names.some((n) => n.includes(needle));
  const fresh: IconicItem[] = [];
  for (const item of ICONIC_ITEMS) {
    if (has(next, item.needle) && !has(prev, item.needle)) fresh.push(item);
  }
  return fresh;
}

/** A loose, dependency-free relative formatter for the welcome-back
 *  banner — "just now", "5 minutes ago", "3 days ago". Keeps the import
 *  graph small (no Intl.RelativeTimeFormat polyfill drama). */
export function describeSavedAt(savedAt: number, now: number = Date.now()): string {
  const diffMs = Math.max(0, now - savedAt);
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
