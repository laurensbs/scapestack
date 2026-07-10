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
    eyebrow: "Add gear",
    title: "RuneLite knows progress. Bank paste or bank sync knows gear.",
    body: "Paste Bank Memory/Bank Tags or enable RuneLite bank sync when the plan needs gear, supplies, quantities or GP. /next can still work without a bank.",
    safety: "Browser paste stays here. RuneLite bank checks send item IDs, names and quantities only, and can be turned off.",
    signals: [
      {
        label: "RuneLite helps",
        value: "skills, quests, diaries, clog, Slayer and bank readiness"
      },
      {
        label: "Bank context helps",
        value: "gear, supplies, quantities and GP"
      },
      {
        label: "Best paste",
        value: "Bank Memory for quantities; Bank Tags for quick item IDs"
      }
    ],
    actions: [
      {
        label: "Paste gear below",
        href: "#bank-paste-panel",
        primary: true
      },
      {
        label: "Check RuneLite",
        href: pluginHref,
        primary: false
      },
      {
        label: "Plan without bank",
        href: withRsnParam("/next", rsn, { source: "plugin-sync", bank: "none" }),
        primary: false
      }
    ]
  };
}
