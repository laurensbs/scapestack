// The other half of the return question: did the visit go anywhere?
//
// route:visit alone tells you people arrive. It does not tell you whether the
// route did anything for them, and a route with high arrivals and no
// engagement is worse than one with fewer of both — it means the promise
// reads well and the page does not deliver.
//
// A visit with no route:engaged is a bounce. Fired at most once per route
// visit so a busy session cannot outweigh a quiet one.

import { track, type AnalyticsRoute } from "./analytics";
import { analyticsRouteFor, visitorForRoute } from "./route-visit";

/** Actions worth counting as "this route did something for me". */
export type RouteEngagementAction =
  | "plan_rendered"
  | "rsn_submitted"
  | "mood_changed"
  | "boss_opened"
  | "bank_attached"
  | "task_checked"
  | "sync_checked";

const engagedRoutes = new Set<AnalyticsRoute>();

/**
 * Records engagement for the route the player is on.
 *
 * Reads the route from the current pathname so callers do not have to know
 * where they are — an action fired from a shared component counts for whichever
 * route hosts it.
 */
export function trackRouteEngagement(action: RouteEngagementAction, pathname?: string): void {
  if (typeof window === "undefined") return;
  const route = analyticsRouteFor(pathname ?? window.location.pathname);
  if (!route || engagedRoutes.has(route)) return;
  engagedRoutes.add(route);

  // Report the bucket the arrival was classified as, not a fresh reading —
  // the arrival already wrote the timestamp, so re-deriving would call every
  // engaged visit a return.
  track("route:engaged", { route, visitor: visitorForRoute(route), action });
}

/** Test seam — the module-level set is intentionally per page load. */
export function resetRouteEngagement(): void {
  engagedRoutes.clear();
}
