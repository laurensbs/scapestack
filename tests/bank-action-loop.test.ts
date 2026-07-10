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
      cta: "Check kill",
      destination: "Kill check",
      proof: "Uses current bank gear and item IDs",
      state: "ready"
    });
    expect(steps[2].body).toContain("this exact bank");
    expect(steps[2].body).toContain("which bosses your current weapons can actually kill");
    expect(steps[3].body).toContain("Use this cleaned bank");
    expect(steps[3].body).toContain("RuneLite can refine quests");
    expect(steps[3].body).not.toContain("combine it with RuneLite sync for exact account-state recommendations");
    expect(steps[3].body).not.toContain("exact account-state recommendations");
    expect(steps[3]).toMatchObject({
      cta: "Open next trip",
      destination: "Next trip",
      proof: "Carries current bank gear into the next plan"
    });
    expect(steps[4]).toMatchObject({
      title: "Check RuneLite",
      cta: "Check RuneLite",
      destination: "RuneLite sync",
      state: "ready"
    });
    expect(steps[4].body).toContain("check the same name");
    expect(steps[4].body).not.toContain("exact plugin data is not assumed");
  });

  it("does not pretend there are tip blockers or sync before the same RSN is checked", () => {
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
      title: "Check RuneLite",
      state: "optional",
      cta: "Check RuneLite",
      proof: "RuneLite optional · same RSN required"
    });
    expect(steps[4].body).toContain("quests, diaries, clog or Slayer matter");
  });

  it("turns review-blocked Plugin Hub state into a sync-check action", () => {
    const steps = buildBankActionLoop({
      tabCount: 8,
      itemCount: 61,
      totalValue: 77_000_000,
      tipCount: 0,
      pluginHubState: "review-blocked"
    });

    expect(steps[4]).toMatchObject({
      title: "Check RuneLite",
      cta: "Check RuneLite",
      destination: "RuneLite sync",
      proof: "RuneLite optional · web planner ready",
      state: "optional"
    });
    expect(steps[4].body).toContain("quests, diaries, clog or Slayer matter");
    expect(steps[4].body).not.toContain("Plugin Hub review is still pending");
  });

  it("keeps closed or unavailable status on the sync checker path", () => {
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
      title: "Check RuneLite",
      destination: "RuneLite sync",
      proof: "RuneLite unknown · same RSN required",
      state: "optional"
    });
    expect(closed[4]).toMatchObject({
      title: "Check RuneLite",
      destination: "RuneLite sync",
      proof: "RuneLite optional · web planner ready",
      state: "optional"
    });
    expect(unknown[4].body).not.toContain("Install Scapestack Sync from RuneLite Plugin Hub");
    expect(closed[4].body).not.toContain("Install Scapestack Sync from RuneLite Plugin Hub");
  });

  it("switches to same-RSN sync copy once the upstream path is ready", () => {
    const steps = buildBankActionLoop({
      tabCount: 8,
      itemCount: 61,
      totalValue: 0,
      tipCount: 0,
      pluginHubState: "merged"
    });

    expect(steps[4]).toMatchObject({
      title: "Check RuneLite",
      cta: "Check RuneLite",
      destination: "RuneLite sync",
      proof: "RuneLite · same RSN required",
      state: "ready"
    });
    expect(steps[4].body).toContain("avoid finished progress");
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

  it("routes bank sync actions to the verify-sync anchor", () => {
    const source = readFileSync(join(process.cwd(), "src/components/bank-result.tsx"), "utf8");

    expect(source).toContain('return `/plugin?${params.toString()}#verify-sync`;');
    expect(source).toContain("onPlugin={() => openBankHandoffRoute(pluginSyncHref)}");
    expect(source).toContain('if (step.id === "sync") return onPlugin;');
    expect(source).not.toContain("onPluginReview");
  });

  it("does not silently navigate when browser storage blocks bank handoff", () => {
    const source = readFileSync(join(process.cwd(), "src/components/bank-result.tsx"), "utf8");

    expect(source).toContain("const [handoffBlockedHref, setHandoffBlockedHref]");
    expect(source).toContain("stored = persistBankHandoffPayload(tabs, window)");
    expect(source).toContain("if (!stored) {");
    expect(source).toContain("setHandoffBlockedHref(href)");
    expect(source).toContain('document.getElementById("bank-handoff-warning")?.scrollIntoView');
    expect(source).toContain("Bank not saved");
    expect(source).toContain("would lose this gear");
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
    expect(source).not.toContain("Use this bank in");
    expect(source).not.toContain("onGoals");
    expect(source).not.toContain("onSlayer");
    expect(source).toContain("group-hover/bank-action:border-[var(--color-accent)]/50");
    expect(source).not.toContain("<article");
    expect(source).not.toContain("className=\"mt-3 inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-2)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent)]\"");
  });
});
