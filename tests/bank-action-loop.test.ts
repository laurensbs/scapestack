import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildBankActionLoop } from "@/lib/bank-action-loop";

describe("bank action loop", () => {
  it("summarizes export, tips and next as one product flow", () => {
    const steps = buildBankActionLoop({
      tabCount: 8,
      itemCount: 61,
      totalValue: 77_000_000,
      tipCount: 2,
      tipSlotsFreed: 5,
      hasPluginSyncHint: true
    });

    expect(steps.map((step) => step.id)).toEqual(["export", "tips", "dps", "next", "sync"]);
    expect(steps[0].body).toContain("8 tabs");
    expect(steps[0].body).toContain("77.00M");
    expect(steps[1]).toMatchObject({ state: "attention", cta: "Open tips" });
    expect(steps[1].proof).toContain("up to 5 slots");
    expect(steps[2]).toMatchObject({
      title: "Check boss gear",
      cta: "Open DPS",
      destination: "/dps calculator",
      proof: "Uses current bank gear and item IDs",
      state: "ready"
    });
    expect(steps[2].body).toContain("this exact bank");
    expect(steps[2].body).toContain("which bosses your current weapons can actually kill");
    expect(steps[3].body).toContain("RuneLite sync");
    expect(steps[3].body).toContain("only after the account payload is verified");
    expect(steps[3].body).not.toContain("combine it with RuneLite sync for exact account-state recommendations");
    expect(steps[3].body).not.toContain("exact account-state recommendations");
    expect(steps[3]).toMatchObject({
      destination: "/next planner",
      proof: "Carries current bank item IDs through session handoff"
    });
    expect(steps[4]).toMatchObject({
      title: "Verify RSN sync",
      cta: "Verify RSN sync",
      destination: "/plugin#verify-sync",
      state: "ready"
    });
    expect(steps[4].body).toContain("verified plugin coverage is not assumed");
    expect(steps[4].body).not.toContain("exact plugin data is not assumed");
  });

  it("does not pretend there are tip blockers or live Plugin Hub install while review is pending", () => {
    const steps = buildBankActionLoop({
      tabCount: 1,
      itemCount: 3,
      totalValue: 0,
      tipCount: 0
    });

    expect(steps[1]).toMatchObject({
      title: "Bank looks tidy",
      state: "optional",
      cta: "Review insights",
      proof: "0 blocking cleanup tips"
    });
    expect(steps[4]).toMatchObject({
      title: "Add local-dev sync",
      state: "optional",
      cta: "Open local setup",
      proof: "PR open · local dev path for testers"
    });
    expect(steps[4].body).toContain("Plugin Hub review is still pending");
  });

  it("turns review-blocked Plugin Hub state into an explicit checklist action", () => {
    const steps = buildBankActionLoop({
      tabCount: 8,
      itemCount: 61,
      totalValue: 77_000_000,
      tipCount: 0,
      pluginHubState: "review-blocked"
    });

    expect(steps[4]).toMatchObject({
      title: "Wait for review fixes",
      cta: "Open review checklist",
      destination: "/plugin#review-readiness",
      proof: "Plugin Hub review blocked · web planner ready",
      state: "attention"
    });
    expect(steps[4].body).toContain("submission handoff is not clean yet");
    expect(steps[4].body).toContain("bank-aware web planning");
    expect(steps[4].body).not.toContain("Plugin Hub review is still pending");
  });

  it("does not advertise install when Plugin Hub status is unavailable or closed", () => {
    const unknown = buildBankActionLoop({
      tabCount: 1,
      itemCount: 3,
      totalValue: 0,
      tipCount: 0,
      pluginHubState: "unknown"
    });
    const closed = buildBankActionLoop({
      tabCount: 1,
      itemCount: 3,
      totalValue: 0,
      tipCount: 0,
      pluginHubState: "closed"
    });

    expect(unknown[4]).toMatchObject({
      title: "Check sync status first",
      destination: "/plugin#review-readiness",
      proof: "Plugin Hub status unavailable",
      state: "optional"
    });
    expect(closed[4]).toMatchObject({
      title: "Plugin submission paused",
      destination: "/plugin#review-readiness",
      proof: "Plugin Hub submission closed",
      state: "attention"
    });
    expect(unknown[4].body).not.toContain("Install Scapestack Sync from RuneLite Plugin Hub");
    expect(closed[4].body).not.toContain("Install Scapestack Sync from RuneLite Plugin Hub");
  });

  it("switches to Plugin Hub install once the upstream PR is merged", () => {
    const steps = buildBankActionLoop({
      tabCount: 8,
      itemCount: 61,
      totalValue: 0,
      tipCount: 0,
      pluginHubState: "merged"
    });

    expect(steps[4]).toMatchObject({
      title: "Install RuneLite sync",
      cta: "Install from Plugin Hub",
      destination: "RuneLite Plugin Hub",
      proof: "Plugin Hub live · payload verification still required",
      state: "ready"
    });
    expect(steps[4].body).toContain("label account coverage as verified, partial or missing");
    expect(steps[4].body).not.toContain("use exact account state");
  });

  it("feeds the bank action loop from the live Plugin Hub status endpoint", () => {
    const source = readFileSync(join(process.cwd(), "src/components/bank-result.tsx"), "utf8");

    expect(source).toContain('fetch("/api/plugin-hub/status")');
    expect(source).toContain("bankPluginHubActionState(status)");
    expect(source).toContain('return hasReviewBlocker ? "review-blocked" : "pending"');
    expect(source).toContain('status.reviewCopyIssues.length > 0');
    expect(source).toContain('status.pinSummary?.includes("behind standalone repo head")');
    expect(source).toContain('status.reviewSummary?.includes("requested changes")');
    expect(source).toContain("pluginHubState");
  });

  it("routes bank review-blocked sync actions to the review-readiness anchor", () => {
    const source = readFileSync(join(process.cwd(), "src/components/bank-result.tsx"), "utf8");

    expect(source).toContain('return `/plugin?${params.toString()}#review-readiness`;');
    expect(source).toContain("onPluginReview={() => openBankHandoffRoute(pluginReviewHref)}");
    expect(source).toContain('step.destination === "/plugin#review-readiness" ? onPluginReview : onPlugin');
  });

  it("does not silently navigate when browser storage blocks bank handoff", () => {
    const source = readFileSync(join(process.cwd(), "src/components/bank-result.tsx"), "utf8");

    expect(source).toContain("const [handoffBlockedHref, setHandoffBlockedHref]");
    expect(source).toContain("stored = persistBankHandoffPayload(tabs, window)");
    expect(source).toContain("if (!stored) {");
    expect(source).toContain("setHandoffBlockedHref(href)");
    expect(source).toContain('document.getElementById("bank-handoff-warning")?.scrollIntoView');
    expect(source).toContain("Bank handoff blocked");
    expect(source).toContain("would lose the exact item context");
    expect(source).toContain("Copy export instead");
    expect(source).toContain("Open without bank");
    expect(source).toContain('params.set("bank", "none")');
  });

  it("makes bank action-loop cards full click targets", () => {
    const source = readFileSync(join(process.cwd(), "src/components/bank-result.tsx"), "utf8");

    expect(source).toContain('data-testid="bank-action-loop-card"');
    expect(source).toContain('aria-label={`${step.cta}: ${step.destination}`}');
    expect(source).toContain("group/bank-action rounded-lg border p-3 text-left");
    expect(source).toContain('if (step.id === "dps") return onDps;');
    expect(source).toContain("md:grid-cols-5");
    expect(source).toContain("group-hover/bank-action:border-[var(--color-accent)]/50");
    expect(source).not.toContain("<article");
    expect(source).not.toContain("className=\"mt-3 inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-2)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent)]\"");
  });
});
