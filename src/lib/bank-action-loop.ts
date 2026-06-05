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
        ? "Send this bank into /next and combine it with RuneLite sync only after the account payload is verified."
        : "Send this bank into /next now. Add RuneLite sync later when you want verified quest, diary, CL and Slayer coverage labels.",
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
      title: "Verify RSN sync",
      body: "RSN is known, but verified plugin coverage is not assumed. Open the sync hub and verify the payload before relying on quests, diaries, CL and Slayer state.",
      cta: "Verify RSN sync",
      destination: "/plugin#verify-sync",
      proof: "RSN detected · payload still needs verification",
      state: "ready"
    };
  }

  if (pluginHubState === "merged") {
    return {
      id: "sync",
      label: "05",
      title: "Install RuneLite sync",
      body: "Install Scapestack Sync from RuneLite Plugin Hub, then verify the payload so recommendations can label account coverage as verified, partial or missing.",
      cta: "Install from Plugin Hub",
      destination: "RuneLite Plugin Hub",
      proof: "Plugin Hub live · payload verification still required",
      state: "ready"
    };
  }

  if (pluginHubState === "review-blocked") {
    return {
      id: "sync",
      label: "05",
      title: "Wait for review fixes",
      body: "The RuneLite submission handoff is not clean yet. Keep using bank-aware web planning; testers can inspect the review checklist before side-loading.",
      cta: "Open review checklist",
      destination: "/plugin#review-readiness",
      proof: "Plugin Hub review blocked · web planner ready",
      state: "attention"
    };
  }

  if (pluginHubState === "closed") {
    return {
      id: "sync",
      label: "05",
      title: "Plugin submission paused",
      body: "Do not send normal players to Plugin Hub while the submission is closed. Use bank paste and public data until the upstream path is restored.",
      cta: "Open plugin status",
      destination: "/plugin#review-readiness",
      proof: "Plugin Hub submission closed",
      state: "attention"
    };
  }

  if (pluginHubState === "unknown") {
    return {
      id: "sync",
      label: "05",
      title: "Check sync status first",
      body: "GitHub status is unavailable, so Plugin Hub install is unproven. Use this bank in /next now and check the plugin page before setup.",
      cta: "Open plugin status",
      destination: "/plugin#review-readiness",
      proof: "Plugin Hub status unavailable",
      state: "optional"
    };
  }

  return {
    id: "sync",
    label: "05",
    title: "Add local-dev sync",
    body: "Plugin Hub review is still pending. Normal players can wait; testers can use the local dev plugin path and verify the payload manually.",
    cta: "Open local setup",
    destination: "/plugin#verify-sync",
    proof: "PR open · local dev path for testers",
    state: "optional"
  };
}
