import type { ReactNode } from "react";

export function PlayerHubShell({
  header,
  lastTrip,
  goals,
  plan,
  routes,
  bank,
  tools,
  account
}: {
  header: ReactNode;
  lastTrip: ReactNode;
  goals?: ReactNode;
  plan: ReactNode;
  routes?: ReactNode;
  bank: ReactNode;
  tools: ReactNode;
  account: ReactNode;
}) {
  return (
    <main className="scape-page max-w-5xl">
      <div data-player-hub-section="header">{header}</div>
      <div data-player-hub-section="last-trip">{lastTrip}</div>
      {goals !== undefined && <div data-player-hub-section="goals">{goals}</div>}
      <div data-player-hub-section="plan">{plan}</div>
      {routes !== undefined && <div data-player-hub-section="routes">{routes}</div>}
      <div data-player-hub-section="bank">{bank}</div>
      <div data-player-hub-section="tools">{tools}</div>
      <div data-player-hub-section="account">{account}</div>
    </main>
  );
}
