import type { SyncedPlayer } from "./sync-repo";
import { CURRENT_PLUGIN_VERSION, pluginSyncHealth, type PluginSyncHealth } from "./plugin-sync";
import { DB_INIT_COMMAND, nextUrlForSyncedRsn, slayerUrlForSyncedRsn } from "./plugin-sync-actions";
import { isPluginBankStatusStale, pluginBankStatusLabel, pluginBankStatusTone } from "./plugin-bank-status";

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
    return signalCoverageTemplate("refresh", "Press Sync again", "This may be old enough that /next should be cautious.");
  }

  return [
    {
      label: "Skills",
      status: player.skills.length > 0 ? "exact" : "missing",
      summary: player.skills.length > 0
        ? `${player.skills.length.toLocaleString()} levels`
        : "No levels",
      detail: player.skills.length > 0
        ? "RuneLite real levels can drive quest and route gates when Hiscores are missing."
        : "Without skill levels, /next falls back to public Hiscores when available."
    },
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
      label: "Bank",
      status: player.bankStatus.itemCount > 0
        ? isPluginBankStatusStale(player.bankStatus) ? "partial" : "exact"
        : player.bankStatus.enabled ? "partial" : "missing",
      summary: pluginBankStatusLabel(player.bankStatus),
      detail: player.bankStatus.itemCount > 0
        ? isPluginBankStatusStale(player.bankStatus)
          ? "Open your bank in RuneLite and sync again before trusting quest or diary item readiness."
          : "Quest and diary readiness can check required items directly from the RuneLite bank payload."
        : player.bankStatus.unavailableReason === "bank-not-opened-this-session"
          ? "Open your bank in RuneLite, then press Sync again before trusting item readiness."
          : player.bankStatus.unavailableReason === "no-items-captured"
            ? "Bank sync is on, but RuneLite did not capture item stacks yet."
            : "Bank sync is off; item readiness uses only pasted or saved browser bank data."
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
  void context;
  const health = pluginSyncHealth({
    pluginVersion: player.pluginVersion,
    syncedAt: player.syncedAt
  });
  const displayName = player.displayName || player.rsn;

  if (health === "outdated") {
    return [
      {
        title: "Update Scapestack Sync",
        body: `Sync came from v${player.pluginVersion || "unknown"}; update the RuneLite plugin before relying on new /next fields.`,
        proof: `Scapestack expects v${CURRENT_PLUGIN_VERSION}.`,
        tone: "danger"
      },
      {
        title: "Re-sync after RuneLite restarts",
        body: "Log back into the target account with Sync on login enabled, then re-run this checker.",
        proof: "Fresh sync should replace the old plugin version.",
        tone: "warning"
      },
      {
        title: "Open /next only as fallback",
        body: "Planning can still run, but recommendations may ignore newer quest, Slayer or collection-log fields.",
        proof: "Keeps bank=none so no gear is guessed.",
        tone: "neutral",
        href: nextUrlForSyncedRsn(displayName),
        actionLabel: "Open /next anyway"
      }
    ];
  }

  if (health === "stale") {
    return [
      {
        title: "Press Sync in RuneLite first",
        body: "Log into the account and wait for the Scapestack chat line before planning tonight's route.",
        proof: "Old RuneLite help can miss newly completed quests, diaries, clog slots or Slayer task changes.",
        tone: "warning"
      },
      {
        title: "Open current /next if you must",
        body: "Use the stale plan for rough direction only; re-check before buying supplies or committing to a grind.",
        proof: "The URL stays bankless so gear is not guessed.",
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
      tone: "warning"
    });
  }

  if (!player.slayer) {
    queue.push({
      title: "Refresh Slayer state",
      body: "Stand logged in long enough for RuneLite's Slayer state to populate, then sync again before relying on task recommendations.",
      proof: "Without Slayer, /next treats task routing as inferred.",
      tone: "warning",
      href: nextUrlForSyncedRsn(displayName),
      actionLabel: "Open /next without Slayer"
    });
  }

  queue.push({
    title: player.slayer ? "Open next plan" : "Open /next without Slayer",
    body: player.slayer
      ? "Use RuneLite to skip finished quests, diary steps, clog slots and Slayer mistakes."
      : "Use RuneLite for quests, diaries and clog while Slayer remains best-effort.",
    proof: "RuneLite is current and linked to this RSN.",
    tone: player.slayer ? "good" : "warning",
    href: nextUrlForSyncedRsn(displayName),
    actionLabel: player.slayer ? "Open next plan" : "Open /next without Slayer"
  });

  if (player.slayer) {
    queue.push({
      title: "Route the live Slayer task",
      body: "Open /slayer when the immediate decision is blocks, unlocks, streak, points or task setup.",
      proof: "Current task, remaining count, points, streak and blocks are present.",
      tone: "good",
      href: slayerUrlForSyncedRsn(displayName),
    actionLabel: "Open Slayer task"
    });
  }

  if (player.bankStatus.itemCount > 0 && !isPluginBankStatusStale(player.bankStatus)) {
    queue.push({
      title: "Use RuneLite bank for item checks",
      body: pluginBankStatusLabel(player.bankStatus),
      proof: "Quest and diary readiness can use synced item IDs, names and quantities.",
      tone: "good",
      href: nextUrlForSyncedRsn(displayName),
      actionLabel: "Open next plan"
    });
  } else {
    const bankTone = pluginBankStatusTone(player.bankStatus);
    queue.push({
      title: player.bankStatus.enabled ? "Refresh RuneLite bank" : "Enable bank sync for item checks",
      body: pluginBankStatusLabel(player.bankStatus),
      proof: isPluginBankStatusStale(player.bankStatus)
        ? "Bank readiness stays cautious until RuneLite captures a fresh bank snapshot."
        : player.bankStatus.enabled
          ? "Bank readiness stays unavailable until RuneLite captures item stacks."
          : "Browser-only gear never goes back to RuneLite; pasted/saved bank remains a fallback.",
      tone: bankTone === "warn" ? "warning" : "neutral",
      href: `/bank?rsn=${encodeURIComponent(displayName)}&from=plugin`,
      actionLabel: player.bankStatus.enabled ? "Open bank help" : "Add gear"
    });
  }

  return queue;
}

function signalCoverageTemplate(
  status: Extract<PluginSignalCoverageStatus, "refresh" | "update">,
  summary: string,
  detail: string
): PluginSignalCoverage[] {
  return ["Quests", "Diaries", "Bank", "Collection log", "Slayer"].map((label) => ({
    label,
    status,
    summary,
    detail
  }));
}

export function diagnosticForMissingSync(rsn: string, context: PluginSyncDiagnosticContext = {}): PluginSyncDiagnostic {
  void context;
  const displayRsn = rsn.trim() || "this RSN";
  return {
    tone: "warning",
    title: `RuneLite not found for ${displayRsn}`,
    body: "/next still works from your OSRS name. Press Sync when you want quests, diaries, clog and Slayer included.",
    steps: [
      "Open RuneLite on this account.",
      "Enable Scapestack Sync and Sync on login.",
      "Press Sync now, then check this RSN again."
    ]
  };
}

export function diagnosticForUnconfiguredSync(): PluginSyncDiagnostic {
  return {
    tone: "danger",
    title: "RuneLite needs setup",
    body: "Scapestack cannot remember RuneLite progress yet. Finish setup, then check this RSN again.",
    steps: [
      "Finish the sync storage setup for this app.",
      "Run the setup command once.",
      "Restart the app so RuneLite checks can save progress.",
      "Enable “Sync on login” in RuneLite, then check the RSN again."
    ],
    primaryAction: { label: "Copy setup command", copy: DB_INIT_COMMAND }
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
      title: "Press Sync before a serious plan",
      body: "The planner can use this RSN, but the last RuneLite check is old. Press Sync before a long grind or GP spend.",
      actionLabel: "Open stale /next plan",
      href
    };
  }

  if (!player.slayer) {
    return {
      tone: "warning",
      title: "/next is usable, Slayer will be guessed",
      body: "Quest, diary and clog progress are live. Current Slayer task picks stay best-effort until RuneLite sends Slayer.",
      actionLabel: "Open /next without Slayer",
      href
    };
  }

  return {
    tone: "good",
    title: "RuneLite is helping /next",
    body: "Open the planner so RuneLite can skip finished quests, diary steps, clog slots and Slayer mistakes.",
    actionLabel: "Open next plan",
    href
  };
}

function liveDiagnostic(player: SyncedPlayer): PluginSyncDiagnostic {
  return {
    tone: "good",
    title: "RuneLite is helping",
    body: "Scapestack has current RuneLite progress for this RSN. /next can skip finished stuff before guessing from public trackers.",
    steps: [
      "Open the /next plan for this RSN.",
      "Keep RuneLite chat feedback enabled so failed syncs are visible.",
      "Open collection-log categories in-game when you want clog checks to expand."
    ],
    primaryAction: {
      label: "Open next plan",
      href: nextUrlForSyncedRsn(player.displayName || player.rsn)
    },
    secondaryAction: {
      label: "Open Slayer task",
      href: slayerUrlForSyncedRsn(player.displayName || player.rsn)
    }
  };
}

function staleDiagnostic(player: SyncedPlayer, hasSlayer: boolean, context: PluginSyncDiagnosticContext): PluginSyncDiagnostic {
  void context;
  return {
    tone: "warning",
    title: "RuneLite needs a fresh press",
    body: "The last RuneLite check is old enough that quests, diaries, clog or Slayer may no longer match the account.",
    steps: [
      "Log into RuneLite on the target account.",
      "Make sure “Sync on login” and chat feedback are enabled.",
      hasSlayer
        ? "Wait for the success chat line, then re-check this page."
        : "Stand logged in long enough for Slayer state to be readable, then re-check.",
      "Use /next only after this page finds the fresh RuneLite check."
    ],
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
    primaryAction: {
      label: "Open plugin check",
      href: "/plugin#verify-sync"
    }
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
  if (health === "live") return "RuneLite is helping";
  if (health === "stale") return "Refresh RuneLite";
  return "Update RuneLite";
}
