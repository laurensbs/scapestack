import { describe, expect, it } from "vitest";
import { HOME_PRODUCT_FLOW, homePluginReadinessPill, homeProductFlowForPluginReadiness, homeProductFlowForPluginState } from "@/lib/home-flow";
import type { PluginHubReviewReadiness } from "@/lib/plugin-hub-status";

describe("homepage product flow", () => {
  it("keeps Scapestack positioned as bank plus RuneLite plus next planner", () => {
    expect(HOME_PRODUCT_FLOW.map((step) => step.href)).toEqual([
      "/bank",
      "/plugin#verify-sync",
      "/next"
    ]);
  });

  it("uses concrete pending-state CTAs instead of generic marketing or false exactness", () => {
    expect(HOME_PRODUCT_FLOW.map((step) => step.cta)).toEqual([
      "Add bank",
      "Check sync",
      "Open planner"
    ]);
    expect(HOME_PRODUCT_FLOW[0].title).toBe("Use the gear you own");
    expect(HOME_PRODUCT_FLOW[0].body).toContain("setups, supplies and upgrades");
    expect(HOME_PRODUCT_FLOW[1].body).toContain("Enter your OSRS name");
    expect(HOME_PRODUCT_FLOW[1].body).toContain("quests, diaries, CL and Slayer");
    expect(HOME_PRODUCT_FLOW[2].title).toBe("Pick tonight's route");
    expect(HOME_PRODUCT_FLOW[2].body).toContain("boss KC, Slayer, quest, diary, GP or low-effort progress");
  });

  it("switches home CTAs to install-ready sync after Plugin Hub merge without faking payloads", () => {
    const flow = homeProductFlowForPluginState("merged");

    expect(flow.map((step) => step.href)).toEqual([
      "/bank",
      "/plugin#verify-sync",
      "/next?from=plugin&bank=none"
    ]);
    expect(flow.map((step) => step.cta)).toEqual([
      "Add bank",
      "Check sync",
      "Open planner"
    ]);
    expect(flow[1].body).toContain("Enable Scapestack Sync");
    expect(flow[1].body).toContain("quests, diaries, collection log and Slayer");
    expect(flow[1].body).not.toContain("Add exact quests");
    expect(flow[2].title).toBe("Pick tonight's route");
    expect(flow[2].body).toContain("one ranked plan");
    expect(flow[2].body).not.toContain("labels exact quest, diary, collection-log and Slayer state");
    expect(flow[2].href).not.toContain("source=plugin-sync");
  });

  it("routes non-installable readiness to the sync checker instead of review copy", () => {
    const readiness: PluginHubReviewReadiness = {
      state: "review-blocked",
      tone: "warning",
      label: "Review handoff is not clean yet",
      detail: "The plugin can be tested locally, but normal players should not be sent to Plugin Hub while reviewer-facing copy or the pinned commit is stale.",
      blockers: ["PR body: token transport"],
      playerInstallReady: false
    };
    const flow = homeProductFlowForPluginReadiness(readiness);

    expect(flow[1]).toMatchObject({
      title: "Add account progress",
      href: "/plugin#verify-sync",
      cta: "Check sync"
    });
    expect(flow[1].body).toContain("pick around quests, diaries, CL and Slayer");
    expect(flow[2].href).toBe("/next");
    expect(homePluginReadinessPill(readiness)).toMatchObject({
      label: "Check sync",
      href: "/plugin#verify-sync",
      playerInstallReady: false
    });
  });

  it("keeps install advertising behind an installable readiness state", () => {
    const readiness: PluginHubReviewReadiness = {
      state: "installable",
      tone: "good",
      label: "Plugin Hub install can be advertised",
      detail: "RuneLite has merged the submission.",
      blockers: [],
      playerInstallReady: true
    };
    const flow = homeProductFlowForPluginReadiness(readiness);

    expect(flow[1].cta).toBe("Check sync");
    expect(flow[1].href).toBe("/plugin#verify-sync");
    expect(homePluginReadinessPill(readiness)).toMatchObject({
      label: "Sync ready",
      href: "/plugin#verify-sync",
      playerInstallReady: true
    });
  });
});
