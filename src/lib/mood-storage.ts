// Mood-keuze + laatste sessie persistentie in localStorage.
//
// Twee dingen worden onthouden:
//   1. mood + tijdsbudget van vorige sessie → terug-keer herkent jouw
//      gewoontes en pre-selecteert
//   2. timestamp + headline-id → "welkom terug; vorige sessie raadden
//      we X" banner
//
// Geen account-binding, geen server — pure client-side. Wanneer een
// gebruiker zijn cache wipet bestaat de geschiedenis niet meer, dat is
// een feature niet een bug (geen lock-in).

import type { Mood, TimeBudget } from "./mood";

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

export function saveMood(session: Omit<MoodSession, "version" | "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const payload: MoodSession = { version: 1, ...session, savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Quota / disabled storage → silently skip
  }
}

export function loadMood(): MoodSession | null {
  if (typeof window === "undefined") return null;
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

/** "5 uur geleden" / "2 dagen geleden" / "net geleden" — voor de
 *  welkom-terug copy. Houden we kort; dezelfde helper als de
 *  SyncedBadge gebruikt, maar UI-niveau verschilt. */
export function relativeSince(epochMs: number): string {
  const sec = Math.max(0, Math.round((Date.now() - epochMs) / 1000));
  if (sec < 90) return "net geleden";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min geleden`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} uur geleden`;
  const day = Math.round(hr / 24);
  return `${day} dag${day === 1 ? "" : "en"} geleden`;
}
