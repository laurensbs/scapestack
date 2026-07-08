import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BANK_PLUGIN_ONBOARDING, bankPluginOnboardingActions } from "@/lib/plugin-onboarding";

describe("bank plugin onboarding", () => {
  it("sends normal bank users to the sync checker before account coverage is trusted", () => {
    expect(BANK_PLUGIN_ONBOARDING.actions).toEqual([
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
    ]);
    expect(BANK_PLUGIN_ONBOARDING.actions[1].href).not.toContain("source=plugin-sync");
    expect(BANK_PLUGIN_ONBOARDING.actions[0].href).toContain("#verify-sync");
  });

  it("switches bank onboarding actions by live Plugin Hub readiness", () => {
    expect(bankPluginOnboardingActions("review-blocked")).toEqual(BANK_PLUGIN_ONBOARDING.actions);
    expect(bankPluginOnboardingActions("merged")).toEqual([
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
    ]);
    expect(bankPluginOnboardingActions("unknown")[1]).toEqual({
      label: "Check RuneLite",
      href: "/plugin?from=bank#verify-sync",
      tone: "secondary"
    });
  });

  it("does not expose endpoint copy in normal bank onboarding", () => {
    expect("copy" in BANK_PLUGIN_ONBOARDING).toBe(false);
  });

  it("communicates finished-progress benefits rather than generic plugin marketing", () => {
    expect(BANK_PLUGIN_ONBOARDING.signals).toContain("Finished quests");
    expect(BANK_PLUGIN_ONBOARDING.signals).not.toContain("Exact quest completion");
    expect(BANK_PLUGIN_ONBOARDING.signals).toContain("Slayer task");
    expect(BANK_PLUGIN_ONBOARDING.body).toContain("RuneLite only helps Scapestack skip quests");
    expect(BANK_PLUGIN_ONBOARDING.title).toContain("RuneLite can help later");
    expect(BANK_PLUGIN_ONBOARDING.body).toContain("clog slots and Slayer");
    expect(BANK_PLUGIN_ONBOARDING.title).not.toContain("exact account state");
    expect(BANK_PLUGIN_ONBOARDING.title).not.toContain("when you opt in");
    expect(BANK_PLUGIN_ONBOARDING.body).not.toContain("payload");
  });

  it("separates pasted bank data from opt-in account-state sync", () => {
    expect(BANK_PLUGIN_ONBOARDING.lanes).toEqual([
      expect.objectContaining({
        label: "Gear now",
        title: "Bank Memory or Bank Tags",
        proof: "Stays in this browser unless you paste it."
      }),
      expect.objectContaining({
        label: "Progress later",
        title: "RuneLite skips done stuff",
        body: "Use /plugin when /next keeps suggesting quests, diaries, clog or Slayer you already finished.",
        proof: "No password, chat, screenshots, inventory or equipment."
      })
    ]);
  });

  it("shows a concrete safe path while Plugin Hub review is pending", () => {
    expect(BANK_PLUGIN_ONBOARDING.readiness).toEqual([
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
    expect(source).toContain("RuneLite can skip");
    expect(source).toContain("RuneLite is helping");
    expect(source).not.toContain("Exact signals Scapestack Sync can unlock");
    expect(source).not.toContain("Exact signals unlocked");
    expect(source).toContain("Use the plan now");
    expect(source).toContain("Check RuneLite later");
    expect(source).toContain("Use /plugin to check");
    expect(source).not.toContain("CopyCommand");
    expect(source).not.toContain("Open review checklist");
    expect(source).not.toContain("review-readiness");
    expect(source).not.toContain("Review handoff blocker");
    expect(source).toContain("Simple path");
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
