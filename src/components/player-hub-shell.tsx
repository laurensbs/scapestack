import type { ReactNode } from "react";

/**
 * Three sections is the page's entire budget — the answer, the goals, the
 * routes. That number is a rule in CLAUDE.md and an assertion in
 * tests/e2e/page-budget.spec.ts, so a slot cannot quietly come back: adding
 * one here fails the build until another is removed.
 *
 * Identity detail, the bank, the skill table and the four bank answers live
 * on /u/[rsn]. They were slots here until 2026-08-08, when the page measured
 * 6.5 screens for 3,478 characters of text.
 */
export function PlayerHubShell({
  header,
  lastTrip,
  plan,
  goals,
  routes
}: {
  header: ReactNode;
  lastTrip: ReactNode;
  plan: ReactNode;
  goals?: ReactNode;
  routes?: ReactNode;
}) {
  return (
    <main className="scape-page max-w-5xl">
      <div data-player-hub-section="header">{header}</div>
      <div data-player-hub-section="last-trip">{lastTrip}</div>
      <div data-player-hub-section="plan">{plan}</div>
      {goals !== undefined && <div data-player-hub-section="goals">{goals}</div>}
      {routes !== undefined && <div data-player-hub-section="routes">{routes}</div>}
    </main>
  );
}
