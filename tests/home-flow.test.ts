import { describe, expect, it } from "vitest";
import { HOME_PRODUCT_FLOW, HOME_SYNC_COPY, homePluginReadinessPill, homeProductFlowForPluginReadiness, homeProductFlowForPluginState, homeSyncServicePill } from "@/lib/home-flow";
import { PUBLIC_SYNC_URL } from "@/lib/plugin-sync-actions";
import type { PluginHubReviewReadiness } from "@/lib/plugin-hub-status";
import type { SyncServiceStatus } from "@/lib/sync-service-readiness";

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
      "Organize bank",
      "Check sync",
      "Plan with current data"
    ]);
    expect(HOME_PRODUCT_FLOW[0].title).toBe("Paste Bank Memory or Bank Tags");
    expect(HOME_PRODUCT_FLOW[0].body).toContain("Bank Memory gives quantities and GP value");
    expect(HOME_PRODUCT_FLOW[0].body).toContain("Bank Tags still gives exact item IDs and layout");
    expect(HOME_PRODUCT_FLOW[1].body).toContain("enter your OSRS name");
    expect(HOME_PRODUCT_FLOW[1].body).toContain("scapestack.org");
    expect(HOME_PRODUCT_FLOW[2].body).toContain("labels guesswork clearly");
  });

  it("switches home CTAs to install-ready sync after Plugin Hub merge without faking payloads", () => {
    const flow = homeProductFlowForPluginState("merged");

    expect(flow.map((step) => step.href)).toEqual([
      "/bank",
      "/plugin#verify-sync",
      "/next?from=plugin&bank=none"
    ]);
    expect(flow.map((step) => step.cta)).toEqual([
      "Organize bank",
      "Check sync",
      "Open planner"
    ]);
    expect(flow[1].body).toContain("Enable Scapestack Sync in RuneLite");
    expect(flow[1].body).toContain("verify a payload before /next trusts quest, diary, collection-log and Slayer coverage labels");
    expect(flow[1].body).not.toContain("Add exact quests");
    expect(flow[2].title).toBe("Run /next with sync ready");
    expect(flow[2].body).toContain("After RuneLite posts a verified payload");
    expect(flow[2].body).toContain("labels quest, diary, collection-log and Slayer coverage as verified, partial or missing");
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
      title: "Check Scapestack Sync",
      href: "/plugin#verify-sync",
      cta: "Check sync"
    });
    expect(flow[1].body).toContain("confirm RuneLite posted to scapestack.org");
    expect(flow[2].href).toBe("/next");
    expect(homePluginReadinessPill(readiness)).toMatchObject({
      label: "Check Scapestack Sync",
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
      label: "Scapestack Sync ready",
      href: "/plugin#verify-sync",
      playerInstallReady: true
    });
  });

  it("exposes the local RuneLite sync URL on the homepage flow", () => {
    expect(HOME_SYNC_COPY).toEqual({
      label: "Copy sync URL",
      value: PUBLIC_SYNC_URL,
      helper: "Paste this into Scapestack Sync if RuneLite still has an old endpoint. It sends only opt-in account-progress signals, not bank data."
    });
  });

  it("summarizes sync service readiness for the homepage loop", () => {
    const base: SyncServiceStatus = {
      ok: true,
      service: "scapestack-sync",
      ready: true,
      plugin: { currentVersion: "0.2.0" },
      endpoints: { sync: "/api/sync", claim: "/api/sync/claim" },
      limits: { maxBodyBytes: 1_000_000, quests: 500, diaries: 64, collectionLogItems: 2000 },
      database: {
        configured: true,
        ready: true,
        missingTables: [],
        missingColumns: { player_sync: [], player_claim: [] }
      }
    };

    expect(homeSyncServicePill(base)).toMatchObject({
      label: "Local sync API ready",
      detail: "Backend endpoint ready for verified payloads · plugin v0.2.0",
      tone: "good",
      href: "/plugin#verify-sync"
    });
    expect(homeSyncServicePill({
      ...base,
      ready: false,
      database: { configured: false, ready: false, missingTables: [], missingColumns: {} }
    })).toMatchObject({
      label: "Local sync API needs DATABASE_URL",
      detail: "Plugin setup can continue, but verified payloads cannot be stored yet.",
      tone: "danger"
    });
    expect(homeSyncServicePill({
      ...base,
      ready: false,
      database: { configured: true, ready: false, missingTables: [], missingColumns: { player_sync: ["slayer"] } }
    })).toMatchObject({
      label: "Local sync API schema check needed",
      detail: "Run the schema initializer before accepting verified plugin payloads.",
      tone: "warning"
    });
  });
});
