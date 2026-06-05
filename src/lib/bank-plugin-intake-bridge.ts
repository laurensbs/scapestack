export interface BankPluginIntakeAction {
  label: string;
  href: string;
  primary: boolean;
}

export interface BankPluginIntakeSignal {
  label: string;
  value: string;
}

export interface BankPluginIntakeBridge {
  eyebrow: string;
  title: string;
  body: string;
  safety: string;
  signals: BankPluginIntakeSignal[];
  actions: BankPluginIntakeAction[];
}

function withRsnParam(path: string, rsn?: string | null, extras: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  const cleanRsn = (rsn ?? "").trim();
  if (cleanRsn) params.set("rsn", cleanRsn);
  for (const [key, value] of Object.entries(extras)) params.set(key, value);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function buildBankPluginIntakeBridge(rsn?: string | null): BankPluginIntakeBridge {
  const pluginHref = `${withRsnParam("/plugin", rsn, { from: "bank" })}#verify-sync`;

  return {
    eyebrow: "RuneLite sync handoff",
    title: "Plugin account-state is separate from this bank paste",
    body: "Use this page to add the missing bank layer: gear, supplies, quantities and GP. That makes /next, DPS and snapshot compare bank-aware instead of account-state only.",
    safety: "Browser-only: this bank paste stays in the web session and is never sent back to the RuneLite plugin.",
    signals: [
      {
        label: "Plugin covers",
        value: "quests, diaries, collection-log IDs and optional Slayer state"
      },
      {
        label: "Bank paste adds",
        value: "item IDs, quantities, stack value, gear and supplies"
      },
      {
        label: "Best format",
        value: "Bank Memory TSV for quantities; Bank Tags if you only need exact item IDs"
      }
    ],
    actions: [
      {
        label: "Paste bank below",
        href: "#bank-paste-panel",
        primary: true
      },
      {
        label: "Verify RuneLite sync",
        href: pluginHref,
        primary: false
      },
      {
        label: "Continue bankless /next",
        href: withRsnParam("/next", rsn, { source: "plugin-sync", bank: "none" }),
        primary: false
      }
    ]
  };
}
