import { formatGp } from "./utils";

export interface BankActionLoopInput {
  tabCount: number;
  itemCount: number;
  totalValue: number;
  tipCount: number;
  tipSlotsFreed?: number;
  hasPluginSyncHint?: boolean;
  pluginHubState?: "pending" | "merged" | "review-blocked" | "unknown" | "closed";
}

export interface BankActionLoopStep {
  id: "export" | "tips" | "dps" | "next" | "sync";
  label: string;
  title: string;
  body: string;
  cta: string;
  destination: string;
  proof: string;
  state: "ready" | "optional" | "attention";
}

export function buildBankActionLoop(input: BankActionLoopInput): BankActionLoopStep[] {
  const itemLabel = `${input.itemCount.toLocaleString()} item${input.itemCount === 1 ? "" : "s"}`;
  const tabLabel = `${input.tabCount} tab${input.tabCount === 1 ? "" : "s"}`;
  const valueLabel = input.totalValue > 0 ? ` · ${formatGp(input.totalValue)} gp` : "";
  const tipSlotLabel = input.tipSlotsFreed && input.tipSlotsFreed > 0
    ? ` · up to ${input.tipSlotsFreed} slot${input.tipSlotsFreed === 1 ? "" : "s"}`
    : "";
  const syncStep = buildSyncStep(input.hasPluginSyncHint === true, input.pluginHubState ?? "pending");

  return [
    {
      id: "export",
      label: "01",
      title: "Paste back to RuneLite",
      body: `${tabLabel} generated from ${itemLabel}${valueLabel}. Copy the Bank Tags strings and import them in RuneLite.`,
      cta: "Copy to RuneLite",
      destination: "RuneLite Bank Tags",
      proof: `${tabLabel} ready · ${itemLabel}${valueLabel}`,
      state: "ready"
    },
    {
      id: "tips",
      label: "02",
      title: input.tipCount > 0 ? "Execute cleanup tips" : "Bank looks tidy",
      body: input.tipCount > 0
        ? `${input.tipCount} actionable tip${input.tipCount === 1 ? "" : "s"} found. Copy a checklist, decant/merge in-game, then rerun the organizer.`
        : "No bank-tip blockers detected. Use smart suggestions if you want more optimisation.",
      cta: input.tipCount > 0 ? "Open tips" : "Review insights",
      destination: input.tipCount > 0 ? "Tips checklist" : "Insights panel",
      proof: input.tipCount > 0
        ? `${input.tipCount} checklist${input.tipCount === 1 ? "" : "s"}${tipSlotLabel}`
        : "0 blocking cleanup tips",
      state: input.tipCount > 0 ? "attention" : "optional"
    },
    {
      id: "dps",
      label: "03",
      title: "Check boss gear",
      body: "Open DPS with this exact bank before you buy upgrades. Scapestack will show which bosses your current weapons can actually kill and what item helps next.",
      cta: "Open DPS",
      destination: "/dps calculator",
      proof: "Uses current bank gear and item IDs",
      state: "ready"
    },
    {
      id: "next",
      label: "04",
      title: "Plan the next session",
      body: input.hasPluginSyncHint
        ? "Send this bank into /next and combine it with RuneLite sync once this same RSN is found."
        : "Send this bank into /next now. Add RuneLite sync later when you want quests, diaries, CL and Slayer included.",
      cta: "Open /next",
      destination: "/next planner",
      proof: "Carries current bank item IDs through session handoff",
      state: "ready"
    },
    syncStep
  ];
}

function buildSyncStep(hasRsnHint: boolean, pluginHubState: NonNullable<BankActionLoopInput["pluginHubState"]>): BankActionLoopStep {
  if (hasRsnHint) {
    return {
      id: "sync",
      label: "05",
      title: "Check RSN sync",
      body: "RSN is known. Open the sync hub and check the same name before relying on quests, diaries, CL and Slayer.",
      cta: "Check RSN sync",
      destination: "/plugin#verify-sync",
      proof: "RSN detected · sync check available",
      state: "ready"
    };
  }

  if (pluginHubState === "merged") {
    return {
      id: "sync",
      label: "05",
      title: "Check sync",
      body: "Enable Scapestack Sync in RuneLite, then check this same RSN so recommendations can avoid finished progress.",
      cta: "Check sync",
      destination: "/plugin#verify-sync",
      proof: "RuneLite sync · same RSN required",
      state: "ready"
    };
  }

  if (pluginHubState === "review-blocked") {
    return {
      id: "sync",
      label: "05",
      title: "Check sync",
      body: "Open the sync checker and use the same RSN when quests, diaries, log items or Slayer matter.",
      cta: "Check sync",
      destination: "/plugin#verify-sync",
      proof: "Sync checker ready · web planner ready",
      state: "optional"
    };
  }

  if (pluginHubState === "closed") {
    return {
      id: "sync",
      label: "05",
      title: "Check sync",
      body: "Use this bank in /next now. Check sync later if /next repeats finished progress.",
      cta: "Check sync",
      destination: "/plugin#verify-sync",
      proof: "Sync check optional · web planner ready",
      state: "optional"
    };
  }

  if (pluginHubState === "unknown") {
    return {
      id: "sync",
      label: "05",
      title: "Check sync",
      body: "Use this bank in /next now, or check the same RSN on the sync page.",
      cta: "Check sync",
      destination: "/plugin#verify-sync",
      proof: "Sync status unknown · checker available",
      state: "optional"
    };
  }

  return {
    id: "sync",
    label: "05",
    title: "Check sync",
    body: "Open the sync checker and use the same RSN when quests, diaries, log items or Slayer matter.",
    cta: "Check sync",
    destination: "/plugin#verify-sync",
    proof: "Sync checker ready · same RSN required",
    state: "optional"
  };
}
