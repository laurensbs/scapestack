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

const RSN_FLOW_STEP: HomeFlowStep = {
  label: "01",
  title: "Start with your RSN",
  body: "Public stats are enough for a first plan.",
  href: "/next",
  cta: "Start with RSN",
  accent: "next"
};

const BANK_FLOW_STEP: HomeFlowStep = {
  label: "02",
  title: "Add bank when gear matters",
  body: "Use it when setups, supplies or GP change the answer.",
  href: "/bank",
  cta: "Add bank",
  accent: "bank"
};

function syncFlowStep(state: PluginHubReviewReadinessState): HomeFlowStep {
  if (state === "installable") {
    return {
      label: "03",
      title: "Sync finished progress",
      body: "Use it when completed quests, diaries, log items or Slayer matter.",
      href: "/plugin#verify-sync",
      cta: "Use sync",
      accent: "sync"
    };
  }

  return {
    label: "03",
    title: "Sync finished progress",
    body: "Use it when /next repeats things you already finished.",
    href: "/plugin#verify-sync",
    cta: "Use sync",
    accent: "sync"
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
    RSN_FLOW_STEP,
    BANK_FLOW_STEP,
    syncFlowStep(state)
  ];
}

export const HOME_PRODUCT_FLOW: HomeFlowStep[] = homeProductFlowForPluginState("open");

export function homePluginReadinessPill(readiness: PluginHubReviewReadiness): HomePluginReadinessPill {
  const playerInstallReady = readiness.playerInstallReady;
  return {
    label: playerInstallReady ? "RuneLite ready" : "Check RuneLite",
    detail: playerInstallReady
      ? "Use the same RSN so /next skips finished progress."
      : "Check your OSRS name when /next repeats finished progress.",
    tone: readiness.tone,
    href: "/plugin#verify-sync",
    playerInstallReady
  };
}
