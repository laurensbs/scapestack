import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BANK_PLUGIN_ONBOARDING, bankPluginOnboardingActions } from "@/lib/plugin-onboarding";
import { LOCAL_SYNC_URL } from "@/lib/plugin-sync-actions";

describe("bank plugin onboarding", () => {
  it("keeps normal bank users on web recommendations while Plugin Hub review is pending", () => {
    expect(BANK_PLUGIN_ONBOARDING.actions).toEqual([
      {
        label: "Use web recommendations",
        href: "/next?from=bank&bank=none",
        tone: "primary"
      },
      {
        label: "Tester RuneLite setup",
        href: "/plugin?from=bank#developer-install",
        tone: "secondary"
      }
    ]);
    expect(BANK_PLUGIN_ONBOARDING.actions[0].href).not.toContain("source=plugin-sync");
    expect(BANK_PLUGIN_ONBOARDING.actions[1].label).toContain("Tester");
  });

  it("switches bank onboarding actions by live Plugin Hub readiness", () => {
    expect(bankPluginOnboardingActions("review-blocked")).toEqual([
      {
        label: "Use web recommendations",
        href: "/next?from=bank&bank=none",
        tone: "primary"
      },
      {
        label: "Open review checklist",
        href: "/plugin?from=bank#review-readiness",
        tone: "secondary"
      }
    ]);
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
      label: "Check plugin status",
      href: "/plugin?from=bank#review-readiness",
      tone: "secondary"
    });
  });

  it("exposes the same local sync URL users must paste in RuneLite", () => {
    expect(BANK_PLUGIN_ONBOARDING.copy).toEqual({
      label: "Copy sync URL",
      value: LOCAL_SYNC_URL
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
        label: "Pending review",
        title: "Public RuneLite install",
        body: "Only call Scapestack Sync publicly installable after the Plugin Hub PR is merged and the stale PR body copy is replaced.",
        state: "pending"
      }
    ]);
  });

  it("shows live Plugin Hub review state on the bank onboarding surface", () => {
    const source = readFileSync(join(process.cwd(), "src/components/bank-plugin-onboarding.tsx"), "utf8");

    expect(source).toContain('fetch("/api/plugin-hub/status")');
    expect(source).toContain("scapestackPluginHubStateFromStatus(status)");
    expect(source).toContain("pluginHubMaintainerReviewGate(status)");
    expect(source).toContain("bankPluginOnboardingActions(pluginHubReadinessState)");
    expect(source).toContain("maintainerReviewGate.title");
    expect(source).toContain("maintainerReviewGate.nextAction");
    expect(source).toContain('pluginHubReadinessState === "merged"');
    expect(source).toContain('pluginHubReadinessState === "review-blocked"');
    expect(source).toContain("const SignalIcon = isPluginHubLive ? CheckCircle2 : Clock3");
    expect(source).toContain('isPluginHubLive ? "text-[var(--color-good)]" : "text-[var(--color-warning)]"');
    expect(source).toContain("Verified coverage Scapestack Sync can unlock");
    expect(source).toContain("Verified coverage blocked by review handoff");
    expect(source).toContain("Verified coverage unlocked");
    expect(source).not.toContain("Exact signals Scapestack Sync can unlock");
    expect(source).not.toContain("Exact signals unlocked");
    expect(source).toContain("Plugin Hub review pending");
    expect(source).toContain("Plugin review handoff blocked");
    expect(source).toContain("Normal players should use bank paste and /next today");
    expect(source).toContain("testers can use the /plugin developer setup");
    expect(source).toContain("not a public install promise");
    expect(source).toContain("Review handoff blocker");
    expect(source).toContain("Code and pin can be ready while RuneLite reviewers still see stale PR body text, a stale pin, or requested changes");
    expect(source).toContain('href="/plugin?from=bank#review-readiness"');
    expect(source).toContain("Open review checklist");
    expect(source).toContain("status.pinSummary");
    expect(source).toContain('status?.reviewSummary?.includes("requested changes")');
    expect(source).toContain("Local sync URL is hidden from this onboarding card until the review handoff is clean");
    expect(source).toContain("Testers can still copy it from the /plugin developer setup");
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

  it("anchors tester setup to a real section on the plugin page", () => {
    const pageSource = readFileSync(join(process.cwd(), "src/app/plugin/page.tsx"), "utf8");

    expect(pageSource).toContain('id="developer-install"');
    expect(pageSource).toContain("Developer / tester install");
  });
});
