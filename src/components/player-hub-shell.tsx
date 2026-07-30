import type { ReactNode } from "react";

export function PlayerHubShell({
  header,
  lastTrip,
  plan,
  bank,
  account
}: {
  header: ReactNode;
  lastTrip: ReactNode;
  plan: ReactNode;
  bank: ReactNode;
  account: ReactNode;
}) {
  return (
    <main className="scape-page max-w-5xl">
      <div data-player-hub-section="header">{header}</div>
      <div data-player-hub-section="last-trip">{lastTrip}</div>
      <div data-player-hub-section="plan">{plan}</div>
      <div data-player-hub-section="bank">{bank}</div>
      <div data-player-hub-section="account">{account}</div>
    </main>
  );
}
