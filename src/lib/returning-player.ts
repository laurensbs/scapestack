// How long has this account been away, and does that change the session?
//
// Wise Old Man exposes `lastChangedAt` — the last time the player gained any
// XP. wom.ts has fetched it since the beginning and planning-input.ts threads
// it into accountMeta, but nothing ever read it: it was set to null in three
// places and no decision depended on it. The one stage built for the case,
// `returning`, was unreachable in practice because it sat at the bottom of the
// account-stage ladder as the 1900+ fallback — so a 1583-total player back
// after five months was told they were a "Midgame main", the same label a
// player who logged out an hour ago gets.
//
// The bands below are deliberately coarse. The exact day count is noise; what
// changes the session is the order of magnitude — a week off means nothing,
// three months means the game moved, a year means the player needs orienting
// before they need a plan.

/** Null-safe: `unknown` when WOM has no record, which is the common case. */
export type AbsenceBand = "unknown" | "active" | "brief" | "lapsed" | "long" | "dormant";

export interface Absence {
  /** Whole days since the last XP gain. Null when we cannot tell. */
  days: number | null;
  band: AbsenceBand;
  /** The raw ISO timestamp we classified, echoed back for display. */
  since: string | null;
}

const DAY_MS = 86_400_000;

/** Lower bound of each band, in days. */
export const ABSENCE_DAYS = {
  brief: 7,
  lapsed: 30,
  long: 90,
  dormant: 365
} as const;

/**
 * Anything from `lapsed` up is treated as a returning player.
 *
 * Thirty days is the first point where the game itself has probably moved:
 * OSRS ships content roughly monthly, so a month away is the shortest gap
 * where "here is what is new" can be true rather than padding.
 */
export function isReturningAbsence(band: AbsenceBand): boolean {
  return band === "lapsed" || band === "long" || band === "dormant";
}

export function classifyAbsence(
  lastChangedAt: string | null | undefined,
  now: number = Date.now()
): Absence {
  if (!lastChangedAt) return { days: null, band: "unknown", since: null };
  const then = new Date(lastChangedAt).getTime();
  if (!Number.isFinite(then)) return { days: null, band: "unknown", since: null };

  // Clamp instead of going negative. WOM timestamps can land slightly ahead of
  // our clock, and a negative gap must read as "playing right now", never as a
  // huge absence via an unsigned wrap somewhere downstream.
  const days = Math.floor(Math.max(0, now - then) / DAY_MS);
  const band: AbsenceBand =
    days >= ABSENCE_DAYS.dormant ? "dormant"
    : days >= ABSENCE_DAYS.long ? "long"
    : days >= ABSENCE_DAYS.lapsed ? "lapsed"
    : days >= ABSENCE_DAYS.brief ? "brief"
    : "active";

  return { days, band, since: lastChangedAt };
}

/**
 * The freshest evidence of activity across every source, as an ISO string.
 *
 * This exists because WOM's lastChangedAt is not a reliable "is this player
 * active" signal on its own. WOM only advances it when something triggers an
 * update of that profile; GET /players/{name} — which is all Scapestack does —
 * returns whatever is cached. A player who logs in daily but whom nobody
 * tracks can carry a lastChangedAt from months ago, and treating that as an
 * absence would tell an active player they had been gone since spring.
 *
 * A plugin snapshot is the stronger signal in the other direction: syncedAt is
 * a timestamp we wrote ourselves when the game client was demonstrably open.
 * Taking the maximum means a stale WOM record can never outvote real evidence,
 * only fill in where there is none.
 */
export function latestActivity(...candidates: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  let bestAt = -Infinity;
  for (const candidate of candidates) {
    if (!candidate) continue;
    const at = new Date(candidate).getTime();
    if (!Number.isFinite(at) || at <= bestAt) continue;
    best = candidate;
    bestAt = at;
  }
  return best;
}

/**
 * "five months", "two years" — the length alone, no verb, so callers can put
 * it in whatever sentence they need.
 *
 * Rounds down on purpose. Telling someone they were away six months when it
 * was five and a half overstates a number they can check against their own
 * memory, and being caught exaggerating on the one fact the player knows best
 * is a bad trade for a rounder word.
 */
export function describeAbsenceLength(days: number | null): string | null {
  if (days === null || days < 0) return null;
  if (days < 14) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 60) {
    const weeks = Math.floor(days / 7);
    return `${weeks} weeks`;
  }
  // Years are carved off in 365-day units and the remainder in 30-day ones, so
  // the remainder reaches 12 whenever it is 360 days or more. Uncapped this
  // printed "1 year and 12 months" — a self-contradictory phrase, for five days
  // out of every year, forever. Capping keeps the round-down promise: 725 days
  // reads "1 year and 11 months", which is short of the truth rather than past
  // it.
  const wholeMonths = (rest: number) => Math.min(11, Math.floor(rest / 30));
  if (days < 365) return `${wholeMonths(days)} months`;

  const years = Math.floor(days / 365);
  const months = wholeMonths(days - years * 365);
  if (months === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"} and ${months} month${months === 1 ? "" : "s"}`;
}
