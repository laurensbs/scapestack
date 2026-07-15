// Mood-keuze + laatste sessie persistentie in localStorage.
//
// Twee dingen worden onthouden:
//   1. mood + tijdsbudget van vorige sessie → terug-keer herkent jouw
//      gewoontes en pre-selecteert
//   2. timestamp + headline-id → "welkom terug; vorige sessie raadden
//      we X" banner
//
// Account-binding blijft client-side: geen server, geen login. Wanneer
// een gebruiker zijn cache wipet bestaat de geschiedenis niet meer; dat
// is bewust geen lock-in.

import type { Mood, TimeBudget } from "./mood";
import { accountIdForRsn, getActiveAccount, loadAccountStore, markAccountMood } from "./account-storage";

const KEY = "scapestack:mood-last:v1";

export interface MoodSession {
  version: 1;
  mood: Mood;
  minutes: TimeBudget;
  /** Recommendation-id die vorige keer als headline werd geserveerd.
   *  Gebruikt voor de "vorige sessie: X" copy. */
  lastHeadlineId?: string;
  /** Display-title van die headline zodat we niet recs hoeven te
   *  matchen voor de banner-tekst. */
  lastHeadlineTitle?: string;
  /** Epoch ms — bepaalt of we de banner überhaupt tonen. */
  savedAt: number;
}

export function saveMood(session: Omit<MoodSession, "version" | "savedAt">, rsn?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const payload: MoodSession = { version: 1, ...session, savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(payload));
    const accountRsn = (rsn ?? getActiveAccount()?.rsn ?? "").trim();
    if (accountRsn) {
      markAccountMood(accountRsn, session.mood, session.minutes, {
        lastHeadlineId: session.lastHeadlineId,
        lastHeadlineTitle: session.lastHeadlineTitle,
        savedAt: payload.savedAt
      });
    }
  } catch {
    // Quota / disabled storage → silently skip
  }
}

export function loadMood(rsn?: string | null): MoodSession | null {
  if (typeof window === "undefined") return null;
  const accountMood = loadAccountMood(rsn);
  if (accountMood) return accountMood;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MoodSession;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function loadAccountMood(rsn?: string | null): MoodSession | null {
  const cleanRsn = (rsn ?? "").trim();
  const account = cleanRsn
    ? loadAccountStore().accounts.find((entry) => entry.id === accountIdForRsn(cleanRsn))
    : getActiveAccount();
  if (!account?.preferredMood || !account.preferredMinutes) return null;
  return {
    version: 1,
    mood: account.preferredMood,
    minutes: account.preferredMinutes,
    lastHeadlineId: account.lastHeadlineId,
    lastHeadlineTitle: account.lastHeadlineTitle,
    savedAt: account.lastHeadlineSavedAt ?? account.lastUsedAt
  };
}

/** "5 hours ago" / "2 days ago" / "just now" — for the welcome-back
 *  copy. Kept short; same helper-shape as SyncedBadge but the UI level
 *  differs slightly. */
export function relativeSince(epochMs: number): string {
  const sec = Math.max(0, Math.round((Date.now() - epochMs) / 1000));
  if (sec < 90) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}
