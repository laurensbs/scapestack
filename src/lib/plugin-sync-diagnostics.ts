import type { SyncedPlayer } from "./sync-repo";
import { CURRENT_PLUGIN_VERSION, pluginSyncHealth, type PluginSyncHealth } from "./plugin-sync";
import { DB_INIT_COMMAND, nextUrlForSyncedRsn, slayerUrlForSyncedRsn, syncUrlsForOrigin } from "./plugin-sync-actions";

export type PluginSyncDiagnosticTone = "good" | "warning" | "danger" | "neutral";

export interface PluginSyncDiagnosticAction {
  label: string;
  href?: string;
  copy?: string;
}

export interface PluginSyncDiagnostic {
  tone: PluginSyncDiagnosticTone;
  title: string;
  body: string;
  steps: string[];
  primaryAction?: PluginSyncDiagnosticAction;
  secondaryAction?: PluginSyncDiagnosticAction;
}

export interface PluginSyncDiagnosticContext {
  origin?: string | null;
}

export interface PluginNextReadiness {
  tone: PluginSyncDiagnosticTone;
  title: string;
  body: string;
  actionLabel: string;
  href?: string;
}

export type PluginSignalCoverageStatus = "exact" | "partial" | "missing" | "refresh" | "update";

export interface PluginSignalCoverage {
  label: string;
  status: PluginSignalCoverageStatus;
  summary: string;
  detail: string;
}

export interface PluginSyncActionQueueItem {
  title: string;
  body: string;
  proof: string;
  tone: PluginSyncDiagnosticTone;
  href?: string;
  copy?: string;
  actionLabel?: string;
}

export function signalCoverageForSyncedPlayer(player: SyncedPlayer): PluginSignalCoverage[] {
  const health = pluginSyncHealth({
    pluginVersion: player.pluginVersion,
    syncedAt: player.syncedAt
  });

  if (health === "outdated") {
    return signalCoverageTemplate("update", "Update plugin first", "This signal may be missing newer fields until the RuneLite plugin is updated.");
  }

  if (health === "stale") {
    return signalCoverageTemplate("refresh", "Refresh sync first", "This signal exists, but the last sync is old enough that /next should treat it cautiously.");
  }

  return [
    {
      label: "Quests",
      status: "exact",
      summary: `${player.questsCompleted.length.toLocaleString()} completed`,
      detail: "RuneLite quest-state overrides public QP heuristics."
    },
    {
      label: "Diaries",
      status: "exact",
      summary: `${player.diariesCompleted.length.toLocaleString()} tiers`,
      detail: "Diary tiers are read directly instead of inferred from levels."
    },
    {
      label: "Collection log",
      status: player.collectionLogItemIds.length > 0 ? "exact" : "partial",
      summary: player.collectionLogItemIds.length > 0
        ? `${player.collectionLogItemIds.length.toLocaleString()} items`
        : "No items yet",
      detail: player.collectionLogItemIds.length > 0
        ? "Synced items can suppress already-owned unlock recommendations."
        : "Open Collection Log categories in-game so RuneLite can read them."
    },
    {
      label: "Slayer",
      status: player.slayer ? "exact" : "missing",
      summary: player.slayer
        ? `${player.slayer.taskRemaining.toLocaleString()} left · ${player.slayer.points.toLocaleString()} pts`
        : "No live task",
      detail: player.slayer
        ? "Current task, points, streak and blocks can shape /next and /slayer."
        : "Without Slayer state, task recommendations stay inferred."
    }
  ];
}

export function actionQueueForSyncedPlayer(player: SyncedPlayer, context: PluginSyncDiagnosticContext = {}): PluginSyncActionQueueItem[] {
  const health = pluginSyncHealth({
    pluginVersion: player.pluginVersion,
    syncedAt: player.syncedAt
  });
  const displayName = player.displayName || player.rsn;
  const syncUrls = syncUrlsForOrigin(context.origin);

  if (health === "outdated") {
    return [
      {
        title: "Update Scapestack Sync",
        body: `Sync came from v${player.pluginVersion || "unknown"}; update the RuneLite plugin before relying on new /next fields.`,
        proof: `Scapestack expects v${CURRENT_PLUGIN_VERSION}.`,
        tone: "danger",
        copy: syncUrls.sync,
        actionLabel: "Copy sync URL"
      },
      {
        title: "Re-sync after RuneLite restarts",
        body: "Log back into the target account with Auto-sync on login enabled, then re-run this checker.",
        proof: "Fresh sync should replace the old plugin version.",
        tone: "warning",
        copy: syncUrls.sync,
        actionLabel: "Copy sync URL"
      },
      {
        title: "Open /next only as fallback",
        body: "Planning can still run, but recommendations may ignore newer quest, Slayer or collection-log fields.",
        proof: "Keeps bank=none so no bank context is implied.",
        tone: "neutral",
        href: nextUrlForSyncedRsn(displayName),
        actionLabel: "Open /next anyway"
      }
    ];
  }

  if (health === "stale") {
    return [
      {
        title: "Refresh RuneLite sync first",
        body: "Log into the account and wait for the Scapestack synced chat line before planning tonight's route.",
        proof: "Old sync can miss newly completed quests, diaries, CL slots or Slayer task changes.",
        tone: "warning",
        copy: syncUrls.sync,
        actionLabel: "Copy sync URL"
      },
      {
        title: "Open current /next if you must",
        body: "Use the stale plan for rough direction only; re-check before buying supplies or committing to a grind.",
        proof: "The URL stays marked as plugin-sync plus bank=none.",
        tone: "neutral",
        href: nextUrlForSyncedRsn(displayName),
        actionLabel: "Open stale /next"
      }
    ];
  }

  const queue: PluginSyncActionQueueItem[] = [];
  if (player.collectionLogItemIds.length === 0) {
    queue.push({
      title: "Open Collection Log tabs in-game",
      body: "RuneLite only exposes collection-log widgets after they are loaded, so browse the relevant categories once and sync again.",
      proof: "This turns CL checks into item-backed suppression.",
      tone: "warning",
      copy: syncUrls.sync,
      actionLabel: "Copy sync URL"
    });
  }

  if (!player.slayer) {
    queue.push({
      title: "Refresh Slayer state",
      body: "Stand logged in long enough for RuneLite's Slayer state to populate, then sync again before relying on task recommendations.",
      proof: "Without Slayer sync, /next treats task routing as inferred.",
      tone: "warning",
      href: nextUrlForSyncedRsn(displayName),
      actionLabel: "Open /next without Slayer"
    });
  }

  queue.push({
    title: player.slayer ? "Open synced /next plan" : "Open /next without Slayer sync",
    body: player.slayer
      ? "Use synced quest, diary, collection-log and Slayer as the account baseline."
      : "Use synced quest, diary and collection-log progress while Slayer remains best-effort.",
    proof: "RuneLite sync is current and linked to this RSN.",
    tone: player.slayer ? "good" : "warning",
    href: nextUrlForSyncedRsn(displayName),
    actionLabel: player.slayer ? "Open synced /next" : "Open /next without Slayer"
  });

  if (player.slayer) {
    queue.push({
      title: "Route the live Slayer task",
      body: "Open /slayer when the immediate decision is blocks, unlocks, streak, points or task setup.",
      proof: "Current task, remaining count, points, streak and blocks are present.",
      tone: "good",
      href: slayerUrlForSyncedRsn(displayName),
      actionLabel: "Open synced Slayer"
    });
  }

  queue.push({
    title: "Paste bank for gear and GP context",
    body: "RuneLite sync deliberately stays bankless; paste a bank in the browser when you want upgrade affordability and item actions.",
    proof: "Browser-only bank context never goes back to the plugin.",
    tone: "neutral",
    href: `/bank?rsn=${encodeURIComponent(displayName)}&from=plugin`,
    actionLabel: "Add bank context"
  });

  return queue;
}

function signalCoverageTemplate(
  status: Extract<PluginSignalCoverageStatus, "refresh" | "update">,
  summary: string,
  detail: string
): PluginSignalCoverage[] {
  return ["Quests", "Diaries", "Collection log", "Slayer"].map((label) => ({
    label,
    status,
    summary,
    detail
  }));
}

export function diagnosticForMissingSync(rsn: string, context: PluginSyncDiagnosticContext = {}): PluginSyncDiagnostic {
  const displayRsn = rsn.trim() || "this RSN";
  const syncUrls = syncUrlsForOrigin(context.origin);
  return {
    tone: "warning",
    title: `No plugin sync found for ${displayRsn}`,
    body: "Scapestack can still use public data, but /next is guessing quests, diaries, collection log and live Slayer state until RuneLite sync finds this RSN.",
    steps: [
      "Open RuneLite and make sure Scapestack Sync is enabled for this account.",
      "Enable “Auto-sync on login” in RuneLite settings.",
      "Set the plugin Sync URL to https://www.scapestack.org/api/sync.",
      "Wait for the in-game “Scapestack sync started” and “synced” chat lines.",
      "Re-run this checker with the exact same RSN spelling."
    ],
    primaryAction: { label: "Copy sync URL", copy: syncUrls.sync }
  };
}

export function diagnosticForUnconfiguredSync(): PluginSyncDiagnostic {
  return {
    tone: "danger",
    title: "Sync database is not configured",
    body: "The plugin can send requests, but Scapestack cannot remember RuneLite progress without the schema behind DATABASE_URL.",
    steps: [
      "Set DATABASE_URL for this app environment.",
      "Run the schema initializer once.",
      "Restart the local Next server so server actions read the updated env.",
      "Enable “Auto-sync on login” in RuneLite, then re-run the sync checker."
    ],
    primaryAction: { label: "Copy init command", copy: DB_INIT_COMMAND }
  };
}

export function diagnosticForSyncedPlayer(player: SyncedPlayer, context: PluginSyncDiagnosticContext = {}): PluginSyncDiagnostic {
  const health = pluginSyncHealth({
    pluginVersion: player.pluginVersion,
    syncedAt: player.syncedAt
  });
  const hasSlayer = Boolean(player.slayer);

  if (health === "outdated") return outdatedDiagnostic(player);
  if (health === "stale") return staleDiagnostic(player, hasSlayer, context);
  if (!hasSlayer) return missingSlayerDiagnostic(player);
  return liveDiagnostic(player);
}

export function nextReadinessForSyncedPlayer(player: SyncedPlayer): PluginNextReadiness {
  const health = pluginSyncHealth({
    pluginVersion: player.pluginVersion,
    syncedAt: player.syncedAt
  });
  const href = nextUrlForSyncedRsn(player.displayName || player.rsn);

  if (health === "outdated") {
    return {
      tone: "danger",
      title: "Fix plugin version before a serious /next run",
      body: "The planner can open, but recommendations may ignore newer RuneLite fields. Update or rebuild the plugin first.",
      actionLabel: "Open /next anyway",
      href
    };
  }

  if (health === "stale") {
    return {
      tone: "warning",
      title: "Refresh sync before a serious plan",
      body: "The planner can use this RSN, but the last sync is old. Re-sync in RuneLite before a long grind or GP spend.",
      actionLabel: "Open stale /next plan",
      href
    };
  }

  if (!player.slayer) {
    return {
      tone: "warning",
      title: "/next is usable, Slayer will be inferred",
      body: "Quest, diary and collection-log state are live. Current Slayer task recommendations remain best-effort until Slayer state syncs.",
      actionLabel: "Open /next without Slayer",
      href
    };
  }

  return {
    tone: "good",
    title: "RuneLite sync is ready for /next",
    body: "Open the planner with this sync so quests, diaries, collection log and Slayer can override guesswork.",
    actionLabel: "Open synced /next plan",
    href
  };
}

function liveDiagnostic(player: SyncedPlayer): PluginSyncDiagnostic {
  return {
    tone: "good",
    title: "RuneLite sync is live",
    body: "Scapestack has current RuneLite progress for this RSN. /next can use it before public trackers and bank inference.",
    steps: [
      "Open the synced /next plan for this RSN.",
      "Keep RuneLite chat feedback enabled so failed syncs are visible.",
      "Open collection-log categories in-game when you want CL item checks to expand."
    ],
    primaryAction: {
      label: "Open synced /next plan",
      href: nextUrlForSyncedRsn(player.displayName || player.rsn)
    },
    secondaryAction: {
      label: "Open synced Slayer",
      href: slayerUrlForSyncedRsn(player.displayName || player.rsn)
    }
  };
}

function staleDiagnostic(player: SyncedPlayer, hasSlayer: boolean, context: PluginSyncDiagnosticContext): PluginSyncDiagnostic {
  const syncUrls = syncUrlsForOrigin(context.origin);
  return {
    tone: "warning",
    title: "Sync exists, but it is stale",
    body: "The last sync is old enough that quests, diaries, collection-log state or Slayer task may no longer match the current account.",
    steps: [
      "Log into RuneLite on the target account.",
      "Make sure “Auto-sync on login” and chat feedback are enabled.",
      hasSlayer
        ? "Wait for the success chat line, then re-check this page."
        : "Stand logged in long enough for Slayer state to be readable, then re-check.",
      "Use /next only after the checker says the sync is live."
    ],
    primaryAction: { label: "Copy sync URL", copy: syncUrls.sync },
    secondaryAction: {
      label: "Open current /next anyway",
      href: nextUrlForSyncedRsn(player.displayName || player.rsn)
    }
  };
}

function outdatedDiagnostic(player: SyncedPlayer): PluginSyncDiagnostic {
  return {
    tone: "danger",
    title: "Plugin update needed",
    body: `This sync came from v${player.pluginVersion || "unknown"}, while Scapestack expects v${CURRENT_PLUGIN_VERSION}. Newer fields may be missing or interpreted incorrectly.`,
    steps: [
      "Update Scapestack Sync in RuneLite.",
      "Restart RuneLite so the new jar is loaded.",
      "Toggle “Force claim retry” once if the next sync is rejected.",
      "Re-run this checker before relying on /next recommendations."
    ],
    primaryAction: { label: "Copy sync URL", copy: "https://www.scapestack.org/api/sync" }
  };
}

function missingSlayerDiagnostic(player: SyncedPlayer): PluginSyncDiagnostic {
  return {
    tone: "warning",
    title: "Sync is live, but Slayer state is missing",
    body: "Quest, diary and collection-log data are usable, but live task recommendations cannot be exact until the plugin reads Slayer state.",
    steps: [
      "Log in on the account with an active RuneLite session.",
      "Open or refresh the in-game task state if RuneLite has not populated it yet.",
      "Sync again and check for Slayer task, points, streak and blocks.",
      "Use /next for non-Slayer planning while this remains missing."
    ],
    primaryAction: {
      label: "Open /next without Slayer",
      href: nextUrlForSyncedRsn(player.displayName || player.rsn)
    }
  };
}

export function healthLabel(health: PluginSyncHealth): string {
  if (health === "live") return "Live sync found";
  if (health === "stale") return "Sync is stale";
  return "Plugin update needed";
}
