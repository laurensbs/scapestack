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
        label: "Verify RuneLite sync",
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

  it("communicates verified coverage benefits rather than generic plugin marketing", () => {
    expect(BANK_PLUGIN_ONBOARDING.signals).toContain("Verified quest completion");
    expect(BANK_PLUGIN_ONBOARDING.signals).not.toContain("Exact quest completion");
    expect(BANK_PLUGIN_ONBOARDING.signals).toContain("Live Slayer task");
    expect(BANK_PLUGIN_ONBOARDING.body).toContain("Scapestack Sync is a separate opt-in RuneLite plugin");
    expect(BANK_PLUGIN_ONBOARDING.title).toContain("verified account coverage after sync");
    expect(BANK_PLUGIN_ONBOARDING.body).toContain("after /next verifies a payload from your live account");
    expect(BANK_PLUGIN_ONBOARDING.title).not.toContain("exact account state");
    expect(BANK_PLUGIN_ONBOARDING.title).not.toContain("when you opt in");
    expect(BANK_PLUGIN_ONBOARDING.body).not.toContain("stops guessing");
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
        title: "Scapestack Sync → coverage labels",
        body: "Use /plugin when you want /next and Slayer advice to verify quests, diaries, CL IDs and task state before labeling them verified, partial or missing.",
        proof: "Never sends RuneScape password, chat, screenshots, inventory or equipment."
      })
    ]);
  });

  it("shows a concrete safe path while Plugin Hub review is pending", () => {
    expect(BANK_PLUGIN_ONBOARDING.readiness).toEqual([
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
    expect(source).toContain("Verified coverage Scapestack Sync can unlock");
    expect(source).toContain("Verified coverage unlocked");
    expect(source).not.toContain("Exact signals Scapestack Sync can unlock");
    expect(source).not.toContain("Exact signals unlocked");
    expect(source).toContain("Sync checker available");
    expect(source).toContain("open /plugin and verify Scapestack Sync");
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
