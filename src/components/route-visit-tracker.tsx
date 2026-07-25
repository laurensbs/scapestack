"use client";

// Fires route:visit once per route the player opens.
//
// Mounted once in the layout rather than added to each page, so a new route
// gets measured by existing in analyticsRouteFor() instead of by someone
// remembering to instrument it.
//
// Renders nothing. If analytics are blocked or storage is unavailable the page
// behaves exactly the same — measurement never gets to affect the product.

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { track, type AnalyticsContext } from "@/lib/analytics";
import { analyticsRouteFor, classifyAndRecordVisit } from "@/lib/route-visit";
import { loadAccountSnapshot } from "@/lib/account-context";

function contextFrom(hasBank: boolean, hasRunelite: boolean): AnalyticsContext {
  if (hasBank && hasRunelite) return "bank_runelite";
  if (hasRunelite) return "runelite";
  if (hasBank) return "bank";
  return "public_stats";
}

export function RouteVisitTracker() {
  const pathname = usePathname();
  // Keyed on the route, not the pathname. /u/alice and /u/bob are two
  // pathnames and one route, and counting the second as a return invented a
  // repeat visit that never happened.
  const recordedRoutes = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!pathname) return;
    const route = analyticsRouteFor(pathname);
    if (!route || recordedRoutes.current.has(route)) return;
    recordedRoutes.current.add(route);

    const visitor = classifyAndRecordVisit(route);
    let context: AnalyticsContext = "public_stats";
    try {
      const snapshot = loadAccountSnapshot();
      context = contextFrom(
        Boolean(snapshot?.hasBankContext),
        Boolean(snapshot?.hasRunelite)
      );
    } catch {
      // Context is a nice-to-have; the visit itself is the measurement.
    }

    // Deduped per page load, so pacing between routes counts once each. A
    // return is coming back later, not walking around now — and localStorage
    // carries the timestamp forward, so next week classifies correctly.
    track("route:visit", { route, visitor, context }, { dedupeKey: `route-visit:${route}` });
  }, [pathname]);

  return null;
}
