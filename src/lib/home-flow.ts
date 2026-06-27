import type { PluginHubReviewReadiness, PluginHubReviewReadinessState } from "@/lib/plugin-hub-status";

export interface HomeFlowStep {
  label: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  accent: "bank" | "sync" | "next";
}

export type HomePluginHubState = "open" | "merged" | "closed" | "unknown";

export interface HomePluginReadinessPill {
  label: string;
  detail: string;
  tone: PluginHubReviewReadiness["tone"];
  href: string;
  playerInstallReady: boolean;
}

const BANK_FLOW_STEP: HomeFlowStep = {
  label: "01",
  title: "Use the gear you own",
  body: "Paste Bank Memory or Bank Tags when you want setups, supplies and upgrades based on your actual bank.",
  href: "/bank",
  cta: "Add bank",
  accent: "bank"
};

function syncFlowStep(state: PluginHubReviewReadinessState): HomeFlowStep {
  if (state === "installable") {
    return {
      label: "02",
      title: "Add account progress",
      body: "Enable Scapestack Sync when you want quests, diaries, collection log and Slayer included in the plan.",
      href: "/plugin#verify-sync",
      cta: "Check sync",
      accent: "sync"
    };
  }

  return {
    label: "02",
    title: "Add account progress",
    body: "Enter your OSRS name on the sync page when you want Scapestack to pick around quests, diaries, CL and Slayer.",
    href: "/plugin#verify-sync",
    cta: "Check sync",
    accent: "sync"
  };
}

function nextFlowStep(state: PluginHubReviewReadinessState): HomeFlowStep {
  if (state === "installable") {
    return {
      label: "03",
      title: "Pick tonight's route",
      body: "Open /next for one ranked plan: boss KC, Slayer, quest, diary, GP or low-effort progress.",
      href: "/next?from=plugin&bank=none",
      cta: "Open planner",
      accent: "next"
    };
  }

  return {
    label: "03",
    title: "Pick tonight's route",
    body: "Open /next for one ranked plan: boss KC, Slayer, quest, diary, GP or low-effort progress.",
    href: "/next",
    cta: "Open planner",
    accent: "next"
  };
}

export function homeProductFlowForPluginState(state: HomePluginHubState): HomeFlowStep[] {
  const readinessState: PluginHubReviewReadinessState = state === "merged"
    ? "installable"
    : state === "closed"
      ? "closed"
      : state === "unknown"
        ? "unknown"
        : "pending-review";
  return homeProductFlowForPluginReadinessState(readinessState);
}

export function homeProductFlowForPluginReadiness(readiness: Pick<PluginHubReviewReadiness, "state">): HomeFlowStep[] {
  return homeProductFlowForPluginReadinessState(readiness.state);
}

export function homeProductFlowForPluginReadinessState(state: PluginHubReviewReadinessState): HomeFlowStep[] {
  return [
    BANK_FLOW_STEP,
    syncFlowStep(state),
    nextFlowStep(state)
  ];
}

export const HOME_PRODUCT_FLOW: HomeFlowStep[] = homeProductFlowForPluginState("open");

export function homePluginReadinessPill(readiness: PluginHubReviewReadiness): HomePluginReadinessPill {
  const playerInstallReady = readiness.playerInstallReady;
  return {
    label: playerInstallReady ? "Sync ready" : "Check sync",
    detail: playerInstallReady
      ? "Use the same RSN so /next can avoid old quest, diary, CL and Slayer suggestions."
      : "Enter your OSRS name on /plugin when you want sharper account-progress checks.",
    tone: readiness.tone,
    href: "/plugin#verify-sync",
    playerInstallReady
  };
}
