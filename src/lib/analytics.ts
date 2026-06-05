// Plausible custom-event wrapper. We fire four events to answer one
// question: "do people who land on the homepage actually use the tool?"
//
//  - next:submit       — RSN submitted on /next (the primary funnel)
//  - homepage:sample   — "See it with a sample bank" clicked on homepage
//  - saved-bank:reuse  — "Use saved bank" tapped in the welcome-back banner
//  - bank:copy         — "Copy to RuneLite" clicked in BankResult
//  - bank:snapshot_compare_copy — compare summary copied from snapshot history
//
// Everything else (page views) is auto-tracked by the script tag. We add
// only the events that mark *intent* — pageviews tell you "they landed",
// these tell you "they did the thing the page exists for."
//
// SSR-safe: no-ops when window or plausible() is missing. Locked event-name
// type prevents typos that would silently never fire.

export type AnalyticsEvent =
  | "next:submit"
  | "homepage:sample"
  | "saved-bank:reuse"
  | "bank:copy"
  | "bank:snapshot_compare_copy";

interface PlausibleFn {
  (event: string, opts?: { props?: Record<string, string | number | boolean> }): void;
}

declare global {
  interface Window {
    plausible?: PlausibleFn;
  }
}

export function track(event: AnalyticsEvent, props?: Record<string, string | number | boolean>): void {
  if (typeof window === "undefined") return;
  const fn = window.plausible;
  if (!fn) return; // dev mode or script blocked — silent no-op
  try {
    fn(event, props ? { props } : undefined);
  } catch { /* analytics is fire-and-forget */ }
}
