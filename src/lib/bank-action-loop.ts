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
      body: "Check the kill with this exact bank before you buy upgrades. Scapestack will show which bosses your current weapons can actually kill and what item helps next.",
      cta: "Check kill",
      destination: "/dps kill check",
      proof: "Uses current bank gear and item IDs",
      state: "ready"
    },
    {
      id: "next",
      label: "04",
      title: "Plan the next session",
      body: input.hasPluginSyncHint
        ? "Send this bank into /next and let RuneLite help once this same RSN is found."
        : "Send this bank into /next now. Add RuneLite later when quests, diaries, clog or Slayer matter.",
      cta: "Open /next",
      destination: "/next planner",
      proof: "Carries current bank gear into the next plan",
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
      title: "Check RuneLite",
      body: "RSN is known; check the same name before relying on quests, diaries, clog and Slayer.",
      cta: "Check RuneLite",
      destination: "/plugin#verify-sync",
      proof: "RSN detected · RuneLite can help",
      state: "ready"
    };
  }

  if (pluginHubState === "merged") {
    return {
      id: "sync",
      label: "05",
      title: "Check RuneLite",
      body: "Enable Scapestack Sync in RuneLite, then check this same RSN so recommendations can avoid finished progress.",
      cta: "Check RuneLite",
      destination: "/plugin#verify-sync",
      proof: "RuneLite · same RSN required",
      state: "ready"
    };
  }

  if (pluginHubState === "review-blocked") {
    return {
      id: "sync",
      label: "05",
      title: "Check RuneLite",
      body: "Use the same RSN when quests, diaries, clog or Slayer matter.",
      cta: "Check RuneLite",
      destination: "/plugin#verify-sync",
      proof: "RuneLite optional · web planner ready",
      state: "optional"
    };
  }

  if (pluginHubState === "closed") {
    return {
      id: "sync",
      label: "05",
      title: "Check RuneLite",
      body: "Use this bank in /next now. Check RuneLite later if /next repeats finished progress.",
      cta: "Check RuneLite",
      destination: "/plugin#verify-sync",
      proof: "RuneLite optional · web planner ready",
      state: "optional"
    };
  }

  if (pluginHubState === "unknown") {
    return {
      id: "sync",
      label: "05",
      title: "Check RuneLite",
      body: "Use this bank in /next now, or check the same RSN on the RuneLite page.",
      cta: "Check RuneLite",
      destination: "/plugin#verify-sync",
      proof: "RuneLite unknown · same RSN required",
      state: "optional"
    };
  }

  return {
    id: "sync",
    label: "05",
    title: "Check RuneLite",
    body: "Use the same RSN when quests, diaries, clog or Slayer matter.",
    cta: "Check RuneLite",
    destination: "/plugin#verify-sync",
    proof: "RuneLite optional · same RSN required",
    state: "optional"
  };
}
