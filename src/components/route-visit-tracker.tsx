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
  // A route counts once per arrival, not once per re-render.
  const lastRecorded = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastRecorded.current === pathname) return;
    const route = analyticsRouteFor(pathname);
    if (!route) return;
    lastRecorded.current = pathname;

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

    // Deduped per page load, so clicking back and forth between two routes in
    // one session counts once each. A return is coming back later, not pacing
    // around now — and localStorage still carries the timestamp forward, so a
    // genuine visit next week classifies correctly.
    track("route:visit", { route, visitor, context }, { dedupeKey: `route-visit:${pathname}` });
  }, [pathname]);

  return null;
}
