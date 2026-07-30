// Return-behaviour measurement.
//
// One question, and nothing else: **which route brings a player back?**
//
// It matters because the product is built around "what should I do next?",
// which a player asks a few times a year — when they come back from a break or
// when they are maxed and bored. "Is this Slayer task worth it?" is asked
// several times a session. That reasoning is sound but unmeasured, and a
// rebuild on an unmeasured hunch is expensive. This is the cheapest way to find
// out which one is true before committing to either.
//
// Privacy: recency is derived from a per-route timestamp in this browser's
// localStorage. No RSN, no server state, nothing that identifies a person, and
// nothing that follows anyone between devices. A cleared browser reads as a
// first visit, which biases the number down — an honest direction to be wrong
// in when the number is being used to justify work.

import type { AnalyticsRoute, AnalyticsVisitor } from "./analytics";

const STORAGE_PREFIX = "scapestack:route-seen:";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * What each route was classified as when the player arrived on it.
 *
 * Engagement is reported under the same bucket as the visit it belongs to.
 * Re-deriving it would be wrong: classifyAndRecordVisit writes the timestamp,
 * so a second call seconds later would read its own write and call every
 * engaged visit "returning_7d".
 */
const visitorByRoute = new Map<AnalyticsRoute, AnalyticsVisitor>();

/** The bucket recorded when the player arrived on this route this page load. */
export function visitorForRoute(route: AnalyticsRoute): AnalyticsVisitor {
  return visitorByRoute.get(route) ?? "first";
}

/** Test seam — the map is intentionally per page load. */
export function resetRouteVisits(): void {
  visitorByRoute.clear();
}

/** Maps a pathname to the route we compare, or null for pages we do not. */
export function analyticsRouteFor(pathname: string): AnalyticsRoute | null {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/next")) return "next";
  if (pathname.startsWith("/slayer")) return "slayer";
  if (pathname.startsWith("/dps")) return "dps";
  if (pathname.startsWith("/bank")) return "bank";
  if (pathname.startsWith("/goals")) return "goals";
  if (pathname.startsWith("/plugin")) return "plugin";
  if (pathname.startsWith("/p/") || pathname.startsWith("/u/")) return "profile";
  return null;
}

/**
 * Classifies this visit against the last one, then records the visit.
 *
 * Pure apart from the storage read/write, so the caller decides when a visit
 * counts. Returns "first" whenever storage is unavailable rather than throwing:
 * a private window must still get a working page.
 */
export function classifyAndRecordVisit(
  route: AnalyticsRoute,
  now: number = Date.now(),
  storage: Pick<Storage, "getItem" | "setItem"> | null = safeStorage()
): AnalyticsVisitor {
  if (!storage) return "first";
  const key = `${STORAGE_PREFIX}${route}`;
  let visitor: AnalyticsVisitor = "first";
  try {
    const previous = Number(storage.getItem(key));
    if (Number.isFinite(previous) && previous > 0) {
      visitor = now - previous <= SEVEN_DAYS_MS ? "returning_7d" : "returning_later";
    }
    storage.setItem(key, String(now));
  } catch {
    return "first";
  }
  visitorByRoute.set(route, visitor);
  return visitor;
}

function safeStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    // Storage can throw outright in a locked-down browser.
    return null;
  }
}
