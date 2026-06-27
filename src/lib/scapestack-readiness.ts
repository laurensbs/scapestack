import { PUBLIC_SYNC_URL, pluginVerifyUrlForSyncedRsn } from "@/lib/plugin-sync-actions";
import { toolHandoffUrl, type ToolHandoffSource } from "@/lib/bank-tool-routes";
import type { PluginHubStatus } from "@/lib/plugin-hub-status";

export type ScapestackSurface = "bank" | "next" | "dps" | "goals" | "profile" | "slayer";
export type ScapestackReadinessStatus = "exact" | "ready" | "missing";
export type ScapestackReadinessSignalId = "bank" | "rsn" | "sync";
export type ScapestackPluginHubState = "pending" | "merged" | "review-blocked" | "unknown" | "closed";

export interface ScapestackReadinessInput {
  surface: ScapestackSurface;
  hasBankContext: boolean;
  hasRsn: boolean;
  hasPluginSync?: boolean;
  pluginSyncState?: "live" | "stale" | "outdated" | null;
  pluginHubState?: ScapestackPluginHubState;
  rsn?: string | null;
}

export interface ScapestackReadinessSignal {
  id: ScapestackReadinessSignalId;
  label: string;
  status: ScapestackReadinessStatus;
  sourceLabel: string;
  detail: string;
  adds: string[];
  boundary: string;
  notice?: string;
  action?: ScapestackReadinessAction;
  copy?: ScapestackReadinessCopy;
  steps?: ScapestackReadinessStep[];
}

export interface ScapestackReadinessAction {
  label: string;
  href: string;
}

export interface ScapestackReadinessCopy {
  label: string;
  value: string;
}

export interface ScapestackReadinessStep {
  label: string;
  body: string;
}

export interface ScapestackReadiness {
  eyebrow: string;
  title: string;
  body: string;
  signals: ScapestackReadinessSignal[];
  primaryAction: ScapestackReadinessAction;
}

const surfaceNames: Record<ScapestackSurface, string> = {
  bank: "Bank Organizer",
  next: "Next planner",
  dps: "DPS planner",
  goals: "Goals tracker",
  profile: "Player profile",
  slayer: "Slayer planner"
};

function sourceForSurface(surface: ScapestackSurface): ToolHandoffSource {
  return surface;
}

export function scapestackPluginHubStateFromStatus(status: PluginHubStatus | null): ScapestackPluginHubState {
  if (!status) return "unknown";
  if (status.state === "merged") return "merged";
  if (status.state === "closed") return "closed";
  if (status.state === "unknown") return "unknown";
  const blocked = status.reviewCopyIssues.length > 0
    || status.pinSummary?.includes("behind standalone repo head") === true
    || status.reviewSummary?.includes("requested changes") === true;
  return blocked ? "review-blocked" : "pending";
}

export function buildScapestackReadiness(input: ScapestackReadinessInput): ScapestackReadiness {
  const cleanRsn = input.rsn?.trim() ?? "";
  const hasPluginSync = Boolean(input.hasPluginSync);
  const pluginSyncState = input.pluginSyncState ?? (hasPluginSync ? "live" : null);
  const hasExactPluginSync = pluginSyncState === "live";
  const pluginHubState = input.pluginHubState ?? "pending";
  const syncUrl = PUBLIC_SYNC_URL;
  const source = sourceForSurface(input.surface);
  const addRsnHref = toolHandoffUrl("/next", source, cleanRsn, {
    hasBankContext: input.hasBankContext
  });
  const syncHref = pluginVerifyUrlForSyncedRsn(cleanRsn, input.surface);
  const syncSetupAction = { label: "Open sync checker", href: syncHref };
  const syncSourceLabel = (() => {
    if (hasExactPluginSync) return "RuneLite sync fresh";
    if (hasPluginSync) return "RuneLite sync needs refresh";
    if (pluginHubState === "merged") return "Ready to check";
    return "Optional account sync";
  })();
  const syncDetail = (() => {
    if (hasExactPluginSync) {
      return "Quests, diaries, collection log and Slayer are included for this RSN.";
    }
    if (pluginSyncState === "outdated") {
      return "Sync exists, but update the RuneLite plugin before relying on newer Slayer and collection-log details.";
    }
    if (pluginSyncState === "stale") {
      return "Sync exists, but refresh RuneLite before a long grind or GP spend.";
    }
    if (pluginHubState === "merged") {
      return "Check the same RSN on /plugin after RuneLite syncs, then /next can avoid finished account progress.";
    }
    return "Use /next now, or check Scapestack Sync when you want quests, diaries, collection log and Slayer included.";
  })();
  const syncNotice = (() => {
    if (hasPluginSync) return undefined;
    if (pluginHubState === "merged") return "RuneLite sync can be checked from the plugin page.";
    return undefined;
  })();
  const syncSteps = hasPluginSync
    ? undefined
    : [
      {
        label: "Open RuneLite",
        body: "Enable Scapestack Sync for the account you want to plan."
      },
      {
        label: "Confirm sync URL",
        body: "The Sync URL should point to https://www.scapestack.org/api/sync."
      },
      {
        label: "Check RSN",
        body: "Run a sync in RuneLite, then check this same OSRS name in Scapestack."
      }
    ];
  const syncCopy = hasPluginSync
    ? undefined
    : { label: "Copy sync URL", value: syncUrl };
  const signals: ScapestackReadinessSignal[] = [
    {
      id: "bank",
      label: "Bank",
      status: input.hasBankContext ? "exact" : "missing",
      sourceLabel: input.hasBankContext ? "Browser-only bank paste" : "No bank source attached",
      detail: input.hasBankContext
        ? "Exact pasted item stack is active."
        : "Paste Bank Tags or use a saved bank.",
      adds: ["gear", "supplies", "quantities", "GP"],
      boundary: "Does not prove quests, diaries, collection log or Slayer state.",
      action: input.hasBankContext
        ? undefined
        : { label: "Paste bank", href: "/bank" }
    },
    {
      id: "rsn",
      label: "RSN",
      status: input.hasRsn ? "ready" : "missing",
      sourceLabel: input.hasRsn ? "Official OSRS Hiscores" : "No OSRS name attached",
      detail: input.hasRsn
        ? `${cleanRsn || "OSRS name"} is attached for Hiscores.`
        : "Add your OSRS name for stat-aware advice.",
      adds: ["stats", "combat level", "public boss KC"],
      boundary: "Does not include bank, inventory, quest completion, diaries or private settings.",
      action: input.hasRsn
        ? undefined
        : { label: "Add RSN", href: addRsnHref }
    },
    {
      id: "sync",
      label: "RuneLite sync",
      status: hasExactPluginSync ? "exact" : hasPluginSync ? "ready" : "missing",
      sourceLabel: syncSourceLabel,
      detail: syncDetail,
      adds: ["quests", "diaries", "collection log", "Slayer"],
      boundary: "Never includes bank, inventory, equipment, chat, screenshots, clicks or account login.",
      notice: syncNotice,
      action: hasPluginSync
        ? { label: "Open sync checker", href: syncHref }
        : syncSetupAction,
      copy: syncCopy,
      steps: syncSteps
    }
  ];

  const primaryAction = (() => {
    if (!input.hasBankContext) {
      return { label: "Paste bank", href: "/bank" };
    }
    if (!input.hasRsn) {
      return {
        label: "Add RSN context",
        href: toolHandoffUrl("/next", source, cleanRsn, { hasBankContext: true })
      };
    }
    if (!hasExactPluginSync) {
      return {
        label: hasPluginSync ? "Refresh sync" : "Check RuneLite sync",
        href: syncHref
      };
    }
    return {
      label: "Open synced /next",
      href: toolHandoffUrl("/next", source, cleanRsn, { hasBankContext: true })
    };
  })();

  const readyCount = signals.filter((signal) => signal.status !== "missing").length;
  const body = hasPluginSync && !hasExactPluginSync
    ? `${readyCount}/3 signals are connected. Bank and Hiscores can plan now; refresh RuneLite sync before relying on quests, diaries, collection log or Slayer.`
    : `${readyCount}/3 signals are connected. Bank paste and Hiscores are enough to plan now; RuneLite sync adds quests, diaries, collection log and Slayer when available.`;

  return {
    eyebrow: "Scapestack readiness",
    title: `${surfaceNames[input.surface]} has ${readyCount}/3 signals connected`,
    body,
    signals,
    primaryAction
  };
}
