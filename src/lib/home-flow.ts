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
  body: "Hiscores gives combat, skills, KC and broad gates. Enough to pick the first useful route for tonight.",
  href: "/next",
  cta: "Start with RSN",
  accent: "next"
};

const BANK_FLOW_STEP: HomeFlowStep = {
  label: "02",
  title: "Add bank when gear matters",
  body: "Paste Bank Memory or Bank Tags when you want setups, supplies and upgrades based on gear you already own.",
  href: "/bank",
  cta: "Add bank",
  accent: "bank"
};

function syncFlowStep(state: PluginHubReviewReadinessState): HomeFlowStep {
  if (state === "installable") {
    return {
      label: "03",
      title: "Sync finished progress",
      body: "Use Scapestack Sync when you want completed quests, diaries, collection log and Slayer kept out of bad suggestions.",
      href: "/plugin#verify-sync",
      cta: "Use sync",
      accent: "sync"
    };
  }

  return {
    label: "03",
    title: "Sync finished progress",
    body: "Enter the same OSRS name on the sync page when you want Scapestack to avoid quests, diaries, CL and Slayer you already handled.",
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
    label: playerInstallReady ? "Sync ready" : "Check sync",
    detail: playerInstallReady
      ? "Use the same RSN so /next can avoid quests, diaries, CL and Slayer you already finished."
      : "Enter your OSRS name on /plugin when you want Scapestack to stop repeating finished progress.",
    tone: readiness.tone,
    href: "/plugin#verify-sync",
    playerInstallReady
  };
}
