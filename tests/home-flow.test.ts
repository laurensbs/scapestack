import { describe, expect, it } from "vitest";
import { HOME_PRODUCT_FLOW, homePluginReadinessPill, homeProductFlowForPluginReadiness, homeProductFlowForPluginState } from "@/lib/home-flow";
import type { PluginHubReviewReadiness } from "@/lib/plugin-hub-status";

describe("homepage product flow", () => {
  it("keeps Scapestack positioned as RSN first, then optional bank and sync", () => {
    expect(HOME_PRODUCT_FLOW.map((step) => step.href)).toEqual([
      "/next",
      "/bank",
      "/plugin#verify-sync"
    ]);
  });

  it("uses concrete pending-state CTAs instead of generic marketing or false exactness", () => {
    expect(HOME_PRODUCT_FLOW.map((step) => step.cta)).toEqual([
      "Start with RSN",
      "Add bank",
      "Use sync"
    ]);
    expect(HOME_PRODUCT_FLOW[0].title).toBe("Start with your RSN");
    expect(HOME_PRODUCT_FLOW[0].body).toContain("Hiscores gives combat");
    expect(HOME_PRODUCT_FLOW[1].title).toBe("Add bank when gear matters");
    expect(HOME_PRODUCT_FLOW[1].body).toContain("gear you already own");
    expect(HOME_PRODUCT_FLOW[2].title).toBe("Sync finished progress");
    expect(HOME_PRODUCT_FLOW[2].body).toContain("avoid quests, diaries, CL and Slayer");
  });

  it("keeps install-ready sync framed as finished-progress filtering", () => {
    const flow = homeProductFlowForPluginState("merged");

    expect(flow.map((step) => step.href)).toEqual([
      "/next",
      "/bank",
      "/plugin#verify-sync"
    ]);
    expect(flow.map((step) => step.cta)).toEqual([
      "Start with RSN",
      "Add bank",
      "Use sync"
    ]);
    expect(flow[2].body).toContain("completed quests, diaries, collection log and Slayer");
    expect(flow[2].body).not.toContain("payload");
    expect(flow[2].body).not.toContain("Plugin Hub");
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

    expect(flow[2]).toMatchObject({
      title: "Sync finished progress",
      href: "/plugin#verify-sync",
      cta: "Use sync"
    });
    expect(flow[2].body).toContain("avoid quests, diaries, CL and Slayer");
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

    expect(flow[2].cta).toBe("Use sync");
    expect(flow[2].href).toBe("/plugin#verify-sync");
    expect(homePluginReadinessPill(readiness)).toMatchObject({
      label: "Sync ready",
      href: "/plugin#verify-sync",
      playerInstallReady: true
    });
  });
});
