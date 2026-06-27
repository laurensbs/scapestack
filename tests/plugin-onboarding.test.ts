import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BANK_PLUGIN_ONBOARDING, bankPluginOnboardingActions } from "@/lib/plugin-onboarding";
import { PUBLIC_SYNC_URL } from "@/lib/plugin-sync-actions";

describe("bank plugin onboarding", () => {
  it("sends normal bank users to the sync checker before account coverage is trusted", () => {
    expect(BANK_PLUGIN_ONBOARDING.actions).toEqual([
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
    ]);
    expect(BANK_PLUGIN_ONBOARDING.actions[1].href).not.toContain("source=plugin-sync");
    expect(BANK_PLUGIN_ONBOARDING.actions[0].href).toContain("#verify-sync");
  });

  it("switches bank onboarding actions by live Plugin Hub readiness", () => {
    expect(bankPluginOnboardingActions("review-blocked")).toEqual(BANK_PLUGIN_ONBOARDING.actions);
    expect(bankPluginOnboardingActions("merged")).toEqual([
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
    ]);
    expect(bankPluginOnboardingActions("unknown")[1]).toEqual({
      label: "Check Scapestack Sync",
      href: "/plugin?from=bank#verify-sync",
      tone: "secondary"
    });
  });

  it("exposes the same local sync URL users must paste in RuneLite", () => {
    expect(BANK_PLUGIN_ONBOARDING.copy).toEqual({
      label: "Copy sync URL",
      value: PUBLIC_SYNC_URL
    });
  });

  it("communicates finished-progress benefits rather than generic plugin marketing", () => {
    expect(BANK_PLUGIN_ONBOARDING.signals).toContain("Quest completion");
    expect(BANK_PLUGIN_ONBOARDING.signals).not.toContain("Exact quest completion");
    expect(BANK_PLUGIN_ONBOARDING.signals).toContain("Live Slayer task");
    expect(BANK_PLUGIN_ONBOARDING.body).toContain("Scapestack Sync is a separate opt-in RuneLite plugin");
    expect(BANK_PLUGIN_ONBOARDING.title).toContain("account progress after sync");
    expect(BANK_PLUGIN_ONBOARDING.body).toContain("adds quests, diaries, collection log and Slayer for the same RSN");
    expect(BANK_PLUGIN_ONBOARDING.title).not.toContain("exact account state");
    expect(BANK_PLUGIN_ONBOARDING.title).not.toContain("when you opt in");
    expect(BANK_PLUGIN_ONBOARDING.body).not.toContain("payload");
  });

  it("separates pasted bank data from opt-in account-state sync", () => {
    expect(BANK_PLUGIN_ONBOARDING.lanes).toEqual([
      expect.objectContaining({
        label: "Paste bank",
        title: "Bank Memory → item stack",
        proof: "Sends bank items only when you paste them here."
      }),
      expect.objectContaining({
        label: "Opt-in sync",
        title: "Scapestack Sync → finished progress",
        body: "Use /plugin when you want /next and Slayer advice to avoid quests, diaries, CL items and task state you already handled.",
        proof: "Never sends RuneScape password, chat, screenshots, inventory or equipment."
      })
    ]);
  });

  it("shows a concrete safe path while Plugin Hub review is pending", () => {
    expect(BANK_PLUGIN_ONBOARDING.readiness).toEqual([
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
    ]);
  });

  it("shows sync checker state on the bank onboarding surface", () => {
    const source = readFileSync(join(process.cwd(), "src/components/bank-plugin-onboarding.tsx"), "utf8");

    expect(source).toContain('fetch("/api/plugin-hub/status")');
    expect(source).toContain("scapestackPluginHubStateFromStatus(status)");
    expect(source).toContain("bankPluginOnboardingActions(pluginHubReadinessState)");
    expect(source).toContain('pluginHubReadinessState === "merged"');
    expect(source).toContain("const SignalIcon = isPluginHubLive ? CheckCircle2 : Clock3");
    expect(source).toContain('isPluginHubLive ? "text-[var(--color-good)]" : "text-[var(--color-warning)]"');
    expect(source).toContain("Progress Scapestack Sync can add");
    expect(source).toContain("Synced progress ready");
    expect(source).not.toContain("Exact signals Scapestack Sync can unlock");
    expect(source).not.toContain("Exact signals unlocked");
    expect(source).toContain("Sync checker available");
    expect(source).toContain("open /plugin and check Scapestack Sync");
    expect(source).toContain("Use the /plugin checker");
    expect(source).toContain("CopyCommand");
    expect(source).not.toContain("Open review checklist");
    expect(source).not.toContain("review-readiness");
    expect(source).not.toContain("Review handoff blocker");
    expect(source).toContain("Safe path today");
    expect(source).toContain("BANK_PLUGIN_ONBOARDING.readiness.map");
    expect(source).toContain('step.state === "ready" ? CheckCircle2 : Clock3');
  });

  it("keeps bank onboarding CTAs above explanation cards on mobile", () => {
    const source = readFileSync(join(process.cwd(), "src/components/bank-plugin-onboarding.tsx"), "utf8");
    const actionIndex = source.indexOf('aria-label="Bank plugin onboarding actions"');
    const lanesIndex = source.indexOf("BANK_PLUGIN_ONBOARDING.lanes.map");
    const readinessIndex = source.indexOf("BANK_PLUGIN_ONBOARDING.readiness.map");

    expect(actionIndex).toBeGreaterThan(0);
    expect(actionIndex).toBeLessThan(lanesIndex);
    expect(actionIndex).toBeLessThan(readinessIndex);
  });

  it("anchors sync setup to the checker on the plugin page", () => {
    const pageSource = readFileSync(join(process.cwd(), "src/app/plugin/page.tsx"), "utf8");

    expect(pageSource).toContain("PLUGIN_VERIFY_SYNC_HASH");
    expect(pageSource).toContain("PluginSyncChecker");
    expect(pageSource).not.toContain('id="developer-install"');
  });
});
