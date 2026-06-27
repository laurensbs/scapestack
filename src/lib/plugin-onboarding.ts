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
  title: "One OSRS plan: bank items now, verified account coverage after sync.",
  body: "Bank Memory gives Scapestack your item stack so the bank organizer can fix layout immediately. Scapestack Sync is a separate opt-in RuneLite plugin that adds quests, diaries, collection log and Slayer state after /next verifies a payload from your live account.",
  lanes: [
    {
      label: "Paste bank",
      title: "Bank Memory → item stack",
      body: "Use this page when you want tabs, GP value, snapshots, drag/drop and copy-back Bank Tags.",
      proof: "Sends bank items only when you paste them here."
    },
    {
      label: "Opt-in sync",
      title: "Scapestack Sync → coverage labels",
      body: "Use /plugin when you want /next and Slayer advice to verify quests, diaries, CL IDs and task state before labeling them verified, partial or missing.",
      proof: "Never sends RuneScape password, chat, screenshots, inventory or equipment."
    }
  ] satisfies PluginOnboardingLane[],
  readiness: [
    {
      label: "Ready now",
      title: "Paste Bank Memory or Bank Tags",
      body: "Bank organization, snapshots, tips and copy-back tags work without Scapestack Sync or Plugin Hub approval.",
      state: "ready"
    },
    {
      label: "Verify first",
      title: "Use /next with bank-aware context",
      body: "Treat account coverage as hiscores-plus-bank until the /plugin checker finds a verified sync payload for the same RSN.",
      state: "verify"
    },
    {
      label: "Sync check",
      title: "Scapestack Sync check",
      body: "Open /plugin when you want to verify the same RSN from RuneLite before trusting quest, diary, CL and Slayer coverage.",
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
    "Verified quest completion",
    "Diary tiers",
    "Collection-log IDs",
    "Live Slayer task"
  ]
};

export function bankPluginOnboardingActions(
  state: ScapestackPluginHubState
): PluginOnboardingAction[] {
  if (state === "merged") {
    return [
      {
        label: "Verify RuneLite sync",
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
