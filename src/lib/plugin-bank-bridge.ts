export const PLUGIN_VERIFY_SYNC_HASH = "verify-sync";

export interface PluginBankBridgeAction {
  id: "next" | "dps" | "slayer" | "sync" | "bank";
  label: string;
  href: string;
  primary: boolean;
}

export interface PluginBankSyncSignal {
  id: "quests" | "diaries" | "collectionLog" | "slayer";
  label: string;
  summary: string;
  detail: string;
}

export const PLUGIN_BANK_SYNC_SIGNALS: PluginBankSyncSignal[] = [
  {
    id: "quests",
    label: "Quest gates",
    summary: "Verified unlock checks",
    detail: "Stops /next from guessing quest access from public hiscores."
  },
  {
    id: "diaries",
    label: "Diary gates",
    summary: "Verified diary tiers",
    detail: "Turns diary requirements into verified labels instead of broad level heuristics."
  },
  {
    id: "collectionLog",
    label: "Collection log",
    summary: "Logged item IDs",
    detail: "Suppresses recommendations for items the account already logged."
  },
  {
    id: "slayer",
    label: "Slayer state",
    summary: "Task, blocks, points",
    detail: "Lets /next and /slayer react to the current task instead of inferred goals."
  }
];

function pluginNextHref(rsn?: string | null): string {
  const params = new URLSearchParams();
  const cleanRsn = (rsn ?? "").trim();
  if (cleanRsn) params.set("rsn", cleanRsn);
  params.set("from", "plugin");
  return `/next?${params.toString()}`;
}

function pluginBankHref(rsn?: string | null): string {
  const params = new URLSearchParams();
  const cleanRsn = (rsn ?? "").trim();
  if (cleanRsn) params.set("rsn", cleanRsn);
  params.set("from", "plugin");
  return `/bank?${params.toString()}`;
}

function pluginToolHref(path: "/dps" | "/slayer", rsn?: string | null): string {
  const params = new URLSearchParams();
  const cleanRsn = (rsn ?? "").trim();
  if (cleanRsn) params.set("rsn", cleanRsn);
  params.set("from", "plugin");
  return `${path}?${params.toString()}`;
}

export function buildPluginBankBridgeActions(rsn?: string | null): PluginBankBridgeAction[] {
  return [
    {
      id: "next",
      label: "Preview bank-aware /next",
      href: pluginNextHref(rsn),
      primary: true
    },
    {
      id: "dps",
      label: "Check bank DPS",
      href: pluginToolHref("/dps", rsn),
      primary: false
    },
    {
      id: "slayer",
      label: "Plan Slayer",
      href: pluginToolHref("/slayer", rsn),
      primary: false
    },
    {
      id: "sync",
      label: "Verify sync",
      href: `#${PLUGIN_VERIFY_SYNC_HASH}`,
      primary: false
    },
    {
      id: "bank",
      label: "Review bank",
      href: pluginBankHref(rsn),
      primary: false
    }
  ];
}
