import { LOCAL_SYNC_URL } from "@/lib/plugin-sync-actions";
import type { PluginHubReviewReadiness, PluginHubReviewReadinessState } from "@/lib/plugin-hub-status";
import type { SyncServiceStatus } from "@/lib/sync-service-readiness";

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
  title: "Paste Bank Memory or Bank Tags",
  body: "Bank Memory gives quantities and GP value; Bank Tags still gives exact item IDs and layout. Both work before any plugin install.",
  href: "/bank",
  cta: "Organize bank",
  accent: "bank"
};

function syncFlowStep(state: PluginHubReviewReadinessState): HomeFlowStep {
  if (state === "installable") {
    return {
      label: "02",
      title: "Install RuneLite sync",
      body: "Plugin Hub install is live. Install Scapestack Sync, then verify a payload before /next trusts quest, diary, collection-log and Slayer coverage labels.",
      href: "/plugin#verify-sync",
      cta: "Install sync",
      accent: "sync"
    };
  }

  if (state === "review-blocked") {
    return {
      label: "02",
      title: "Fix RuneLite review handoff",
      body: "The plugin can be tested locally, but normal players should stay on web recommendations until reviewer copy and the pinned commit are clean.",
      href: "/plugin#review-readiness",
      cta: "Open review checklist",
      accent: "sync"
    };
  }

  if (state === "unknown") {
    return {
      label: "02",
      title: "Check RuneLite sync status",
      body: "GitHub status is unavailable. Treat Plugin Hub install as unproven and use bank paste plus Hiscores until the live PR is checked.",
      href: "/plugin",
      cta: "Open plugin status",
      accent: "sync"
    };
  }

  return {
    label: "02",
    title: "Track RuneLite sync",
    body: state === "closed"
      ? "The Plugin Hub submission is paused. Use bank paste and public trackers now; developer install remains available for testers."
      : "Plugin Hub review is pending. Use bank paste and Hiscores now; testers can side-load the local plugin loop.",
    href: "/plugin",
    cta: state === "closed" ? "Open plugin status" : "Track plugin review",
    accent: "sync"
  };
}

function nextFlowStep(state: PluginHubReviewReadinessState): HomeFlowStep {
  if (state === "installable") {
    return {
      label: "03",
      title: "Run /next with sync ready",
      body: "Hiscores and bank data work immediately. After RuneLite posts a verified payload, /next labels quest, diary, collection-log and Slayer coverage as verified, partial or missing.",
      href: "/next?from=plugin&bank=none",
      cta: "Open planner",
      accent: "next"
    };
  }

  return {
    label: "03",
    title: "Run /next now",
    body: "Hiscores and bank context still produce a useful session plan. The planner labels guesswork clearly until RuneLite sync is verified.",
    href: "/next",
    cta: "Plan with current data",
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
  return {
    label: readiness.playerInstallReady
      ? "Plugin Hub install ready"
      : readiness.state === "review-blocked"
        ? "Plugin review handoff needs fixes"
        : readiness.state === "pending-review"
          ? "Plugin review pending"
          : readiness.state === "closed"
            ? "Plugin submission closed"
            : "Plugin install readiness unknown",
    detail: readiness.detail,
    tone: readiness.tone,
    href: readiness.playerInstallReady ? "/plugin#verify-sync" : "/plugin#review-readiness",
    playerInstallReady: readiness.playerInstallReady
  };
}

export const HOME_SYNC_COPY = {
  label: "Copy sync URL",
  value: LOCAL_SYNC_URL,
  helper: "Paste this into the Scapestack Sync plugin while running the local app. It still sends only opt-in account-progress signals, not bank data."
};

export interface HomeSyncServicePill {
  label: string;
  detail: string;
  tone: "good" | "warning" | "danger";
  href: string;
}

export function homeSyncServicePill(status: SyncServiceStatus): HomeSyncServicePill {
  if (status.ready) {
    return {
      label: "Local sync API ready",
      detail: `Backend endpoint ready for verified payloads · plugin v${status.plugin.currentVersion}`,
      tone: "good",
      href: "/plugin#verify-sync"
    };
  }

  if (!status.database.configured) {
    return {
      label: "Local sync API needs DATABASE_URL",
      detail: "Plugin setup can continue, but verified payloads cannot be stored yet.",
      tone: "danger",
      href: "/plugin#verify-sync"
    };
  }

  return {
    label: "Local sync API schema check needed",
    detail: "Run the schema initializer before accepting verified plugin payloads.",
    tone: "warning",
    href: "/plugin#verify-sync"
  };
}
