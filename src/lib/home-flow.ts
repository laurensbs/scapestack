import { PUBLIC_SYNC_URL } from "@/lib/plugin-sync-actions";
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
      title: "Sync your account",
      body: "Enable Scapestack Sync in RuneLite, then verify a payload before /next trusts quest, diary, collection-log and Slayer coverage labels.",
      href: "/plugin#verify-sync",
      cta: "Check sync",
      accent: "sync"
    };
  }

  return {
    label: "02",
    title: "Check Scapestack Sync",
    body: "Open the sync checker, enter your OSRS name, and confirm RuneLite posted to scapestack.org before the planner trusts private account coverage.",
    href: "/plugin#verify-sync",
    cta: "Check sync",
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
  const playerInstallReady = readiness.playerInstallReady;
  return {
    label: playerInstallReady ? "Scapestack Sync ready" : "Check Scapestack Sync",
    detail: playerInstallReady
      ? "RuneLite sync is ready to verify for the same RSN before /next trusts private account coverage."
      : "Enter your OSRS name on /plugin and verify a RuneLite payload before relying on account-specific coverage.",
    tone: readiness.tone,
    href: "/plugin#verify-sync",
    playerInstallReady
  };
}

export const HOME_SYNC_COPY = {
  label: "Copy sync URL",
  value: PUBLIC_SYNC_URL,
  helper: "Paste this into Scapestack Sync if RuneLite still has an old endpoint. It sends only opt-in account-progress signals, not bank data."
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
