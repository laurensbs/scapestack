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
  title: "Paste gear now. RuneLite can help later.",
  body: "Use Bank Memory when a trip depends on gear, supplies, quantities or GP. RuneLite only helps Scapestack skip quests, diaries, clog slots and Slayer you already handled.",
  lanes: [
    {
      label: "Gear now",
      title: "Bank Memory or Bank Tags",
      body: "Use this page for tabs, GP value, snapshots and copy-back Bank Tags.",
      proof: "Stays in this browser unless you paste it."
    },
    {
      label: "Progress later",
      title: "RuneLite skips done stuff",
      body: "Use /plugin when /next keeps suggesting quests, diaries, clog or Slayer you already finished.",
      proof: "No password, chat, screenshots, inventory or equipment."
    }
  ] satisfies PluginOnboardingLane[],
  readiness: [
    {
      label: "1",
      title: "Paste gear if it matters",
      body: "Bank organization, snapshots, tips and copy-back tags work without RuneLite.",
      state: "ready"
    },
    {
      label: "2",
      title: "Open one plan",
      body: "Use Hiscores plus gear now. RuneLite can be added only when finished progress matters.",
      state: "verify"
    },
    {
      label: "3",
      title: "Check RuneLite later",
      body: "Open /plugin when quest, diary, clog or Slayer mistakes would waste a session.",
      state: "pending"
    }
  ] satisfies PluginOnboardingReadinessStep[],
  actions: [
    {
      label: "Check RuneLite",
      href: "/plugin?from=bank#verify-sync",
      tone: "primary"
    },
    {
      label: "Use /next",
      href: "/next?from=bank&bank=none",
      tone: "secondary"
    }
  ] satisfies PluginOnboardingAction[],
  copy: {
    label: "Copy sync URL",
    value: PUBLIC_SYNC_URL
  } satisfies PluginOnboardingCopy,
  signals: [
    "Finished quests",
    "Diary tiers",
    "Clog slots",
    "Slayer task"
  ]
};

export function bankPluginOnboardingActions(
  state: ScapestackPluginHubState
): PluginOnboardingAction[] {
  if (state === "merged") {
    return [
      {
        label: "Check RuneLite",
        href: "/plugin?from=bank#verify-sync",
        tone: "primary"
      },
      {
        label: "Open /next",
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
      label: "Use /next",
      href: "/next?from=bank&bank=none",
      tone: "primary"
    },
    {
      label: "Check RuneLite",
      href: "/plugin?from=bank#verify-sync",
      tone: "secondary"
    }
  ];
}
