import { PUBLIC_SYNC_URL } from "@/lib/plugin-sync-actions";
import type { ScapestackPluginHubState } from "@/lib/scapestack-readiness";

export interface PluginOnboardingAction {
  label: string;
  href: string;
  tone: "primary" | "secondary";
}

export interface PluginOnboardingCopy {
  label: string;
  value: string;
}

export interface PluginOnboardingLane {
  label: string;
  title: string;
  body: string;
  proof: string;
}

export interface PluginOnboardingReadinessStep {
  label: string;
  title: string;
  body: string;
  state: "ready" | "verify" | "pending";
}

export const BANK_PLUGIN_ONBOARDING = {
  eyebrow: "RuneLite sync",
  title: "One OSRS plan: bank items now, account progress after sync.",
  body: "Bank Memory gives Scapestack your item stack so the bank organizer can fix layout immediately. Scapestack Sync is a separate opt-in RuneLite plugin that adds quests, diaries, collection log and Slayer for the same RSN.",
  lanes: [
    {
      label: "Paste bank",
      title: "Bank Memory → item stack",
      body: "Use this page when you want tabs, GP value, snapshots, drag/drop and copy-back Bank Tags.",
      proof: "Sends bank items only when you paste them here."
    },
    {
      label: "Opt-in sync",
      title: "Scapestack Sync → finished progress",
      body: "Use /plugin when you want /next and Slayer advice to avoid quests, diaries, CL items and task state you already handled.",
      proof: "Never sends RuneScape password, chat, screenshots, inventory or equipment."
    }
  ] satisfies PluginOnboardingLane[],
  readiness: [
    {
      label: "Ready now",
      title: "Paste Bank Memory or Bank Tags",
      body: "Bank organization, snapshots, tips and copy-back tags work without Scapestack Sync.",
      state: "ready"
    },
    {
      label: "Use now",
      title: "Use /next with bank-aware context",
      body: "Use Hiscores plus bank now. Add sync when you want Scapestack to avoid finished account progress for the same RSN.",
      state: "verify"
    },
    {
      label: "Sync check",
      title: "Scapestack Sync check",
      body: "Open /plugin when you want to check the same RSN from RuneLite before relying on quest, diary, CL and Slayer.",
      state: "pending"
    }
  ] satisfies PluginOnboardingReadinessStep[],
  actions: [
    {
      label: "Check Scapestack Sync",
      href: "/plugin?from=bank#verify-sync",
      tone: "primary"
    },
    {
      label: "Use web recommendations",
      href: "/next?from=bank&bank=none",
      tone: "secondary"
    }
  ] satisfies PluginOnboardingAction[],
  copy: {
    label: "Copy sync URL",
    value: PUBLIC_SYNC_URL
  } satisfies PluginOnboardingCopy,
  signals: [
    "Quest completion",
    "Diary tiers",
    "Collection-log items",
    "Live Slayer task"
  ]
};

export function bankPluginOnboardingActions(
  state: ScapestackPluginHubState
): PluginOnboardingAction[] {
  if (state === "merged") {
    return [
      {
        label: "Check RuneLite sync",
        href: "/plugin?from=bank#verify-sync",
        tone: "primary"
      },
      {
        label: "Preview /next readiness",
        href: "/next?from=bank&bank=none",
        tone: "secondary"
      }
    ];
  }

  if (state === "review-blocked") {
    return BANK_PLUGIN_ONBOARDING.actions;
  }

  if (state === "pending") {
    return BANK_PLUGIN_ONBOARDING.actions;
  }

  return [
    {
      label: "Use web recommendations",
      href: "/next?from=bank&bank=none",
      tone: "primary"
    },
    {
      label: "Check Scapestack Sync",
      href: "/plugin?from=bank#verify-sync",
      tone: "secondary"
    }
  ];
}
