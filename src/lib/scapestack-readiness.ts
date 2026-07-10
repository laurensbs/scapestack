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
  bank: "setup",
  next: "next plan",
  dps: "boss trip",
  goals: "unlock route",
  profile: "profile",
  slayer: "Slayer task"
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
  const syncSetupAction = { label: "Check RuneLite", href: syncHref };
  const syncSourceLabel = (() => {
    if (hasExactPluginSync) return "RuneLite helping";
    if (hasPluginSync) return "Press Sync again";
    if (pluginHubState === "merged") return "RuneLite can help";
    return "RuneLite later";
  })();
  const syncDetail = (() => {
    if (hasExactPluginSync) {
      return "Finished quests, diaries, clog slots and Slayer are skipped for this RSN.";
    }
    if (pluginSyncState === "outdated") {
      return "Update RuneLite, then press Sync before long Slayer, clog or quest choices.";
    }
    if (pluginSyncState === "stale") {
      return "Press Sync again before a long grind or GP spend.";
    }
    if (pluginHubState === "merged") {
      return "Check this same RSN after pressing Sync in RuneLite, then /next can skip finished progress.";
    }
    return "Use /next now. Check RuneLite later when quests, diaries, clog or Slayer matter.";
  })();
  const syncNotice = (() => {
    if (hasPluginSync) return undefined;
    if (pluginHubState === "merged") return "RuneLite can be checked from the plugin page.";
    return undefined;
  })();
  const syncSteps = hasPluginSync
    ? undefined
    : [
      {
        label: "Open RuneLite",
        body: "Turn on Scapestack Sync for this account."
      },
      {
        label: "Use scapestack.org link",
        body: "The Sync URL should point to https://www.scapestack.org/api/sync."
      },
      {
        label: "Check the RSN",
        body: "Press Sync, then check this same OSRS name in Scapestack."
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
      sourceLabel: input.hasBankContext ? "Bank added" : "No bank",
      detail: input.hasBankContext
        ? "Gear, supplies, quantities and GP can shape this trip."
        : "Add bank when gear, supplies or GP change the trip.",
      adds: ["gear", "supplies", "quantities", "GP"],
      boundary: "Does not prove quests, diaries, collection log or Slayer state.",
      action: input.hasBankContext
        ? undefined
        : { label: "Add bank", href: "/bank" }
    },
    {
      id: "rsn",
      label: "RSN",
      status: input.hasRsn ? "ready" : "missing",
      sourceLabel: input.hasRsn ? "Hiscores loaded" : "No OSRS name",
      detail: input.hasRsn
        ? `${cleanRsn || "OSRS name"} is used for stats and public boss KC.`
        : "Add an OSRS name for stat-aware picks.",
      adds: ["stats", "combat level", "public boss KC"],
      boundary: "Does not include bank, inventory, quest completion, diaries or private settings.",
      action: input.hasRsn
        ? undefined
        : { label: "Add OSRS name", href: addRsnHref }
    },
    {
      id: "sync",
      label: "RuneLite sync",
      status: hasExactPluginSync ? "exact" : hasPluginSync ? "ready" : "missing",
      sourceLabel: syncSourceLabel,
      detail: syncDetail,
      adds: ["skills", "quests", "diaries", "collection log", "Slayer", "bank readiness"],
      boundary: "Bank item IDs/names/quantities are included when bank checks are on; never includes inventory, equipment, chat, screenshots, clicks or account login.",
      notice: syncNotice,
      action: hasPluginSync
        ? { label: "Check RuneLite", href: syncHref }
        : syncSetupAction,
      copy: syncCopy,
      steps: syncSteps
    }
  ];

  const primaryAction = (() => {
    if (!input.hasBankContext) {
      return { label: "Add bank", href: "/bank" };
    }
    if (!input.hasRsn) {
      return {
        label: "Add OSRS name",
        href: toolHandoffUrl("/next", source, cleanRsn, { hasBankContext: true })
      };
    }
    if (!hasExactPluginSync) {
      return {
        label: hasPluginSync ? "Fresh RuneLite check" : "Check RuneLite",
        href: syncHref
      };
    }
    return {
      label: "Open next plan",
      href: toolHandoffUrl("/next", source, cleanRsn, { hasBankContext: true })
    };
  })();

  const body = hasPluginSync && !hasExactPluginSync
    ? "Setup and stats can plan now. Press RuneLite sync again before long quests, diaries, clog or Slayer choices."
    : "Setup and stats are enough for a first plan. RuneLite only helps avoid finished quests, diary steps, clog slots and Slayer mistakes.";

  return {
    eyebrow: "Make it smarter",
    title: `Make this ${surfaceNames[input.surface]} sharper`,
    body,
    signals,
    primaryAction
  };
}
