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

const BANK_KEY = "scapestack:saved-bank:v1";
const RSN_KEY = "scapestack:saved-rsn:v1";
const DISABLED_SESSION_KEY = "scapestack:save-bank:disabled";

export interface SavedBank {
  /** Schema version — bump only if the payload shape changes. */
  version: 1;
  /** The raw banktags string the user pasted. Source-of-truth, not the
   *  derived OrganizeResult. */
  banktags: string;
  /** Epoch ms when the bank was saved. Used for the "from X ago" badge. */
  savedAt: number;
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
export function loadSavedBank(): SavedBank | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = localStorage.getItem(BANK_KEY);
  } catch { return null; }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Malformed JSON — clean the slot and bail.
    try { localStorage.removeItem(BANK_KEY); } catch {}
    return null;
  }
  if (!isValidSavedBank(parsed)) {
    try { localStorage.removeItem(BANK_KEY); } catch {}
    return null;
  }
  return parsed;
}

/** Save the bank. No-op when the user has disabled saving for this
 *  session; that keeps shared-device hygiene predictable. */
export function saveSavedBank(banktags: string): void {
  if (typeof window === "undefined") return;
  if (isSaveBankDisabled()) return;
  const trimmed = banktags.trim();
  if (!trimmed) return; // never persist an empty paste
  const payload: SavedBank = { version: 1, banktags: trimmed, savedAt: Date.now() };
  try {
    localStorage.setItem(BANK_KEY, JSON.stringify(payload));
  } catch { /* quota exceeded / private mode — silently skip */ }
}

/** Drop the saved bank. Safe to call when nothing is saved. */
export function clearSavedBank(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(BANK_KEY); } catch {}
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
  try { localStorage.setItem(RSN_KEY, trimmed); } catch {}
}

export function clearSavedRsn(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(RSN_KEY); } catch {}
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
