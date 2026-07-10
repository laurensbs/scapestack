import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pluginContextFromSearchParams, pluginHeroActions } from "@/app/plugin/page";

describe("plugin page copy constants", () => {
  it("keeps the player sync flow focused on RSN, .org sync and next actions", () => {
    const pageSource = readFileSync(join(process.cwd(), "src/app/plugin/page.tsx"), "utf8");

    expect(pageSource).toContain("Check RuneLite.");
    expect(pageSource).toContain("Skip done stuff.");
    expect(pageSource).toContain("No login");
    expect(pageSource).toContain("Bank opt-in");
    expect(pageSource).toContain("No screenshots");
    expect(pageSource).toContain("PluginTrustPill");
    expect(pageSource).toContain("Check RuneLite");
    expect(pageSource).toContain("Open one plan");
    expect(pageSource).toContain("Setup help");
    expect(pageSource).toContain("Normal setup");
    expect(pageSource).toContain("The public plugin connects to Scapestack automatically; there is no URL to paste for normal players.");
    expect(pageSource).toContain("PLAYER_SYNC_CHOICES");
    expect(pageSource).toContain("Press Sync now once");
    expect(pageSource).toContain("Turn on Sync on login");
    expect(pageSource).toContain("Use bank for readiness");
    expect(pageSource).toContain("Refresh after quests");
    expect(pageSource).not.toContain("Developer/self-hosting endpoint");
    expect(pageSource).not.toContain("Copy developer endpoint");
    expect(pageSource).not.toContain("PUBLIC_SYNC_URL");
    expect(pageSource).not.toContain("https://www.scapestack.org/api/sync");
    expect(pageSource).not.toContain("Copy sync URL");
    expect(pageSource).not.toContain("Scapestack link");
    expect(pageSource).not.toContain("scapestack.app");
    expect(pageSource).toContain("PluginSyncChecker");
    expect(pageSource).toContain("RuneliteOpenButton");
    expect(pageSource).toContain("Open one plan");
    expect(pageSource).toContain("After Sync now");
    expect(pageSource).toContain("Open one plan that skips finished stuff.");
    expect(pageSource).toContain("Press Sync now in RuneLite.");
    expect(pageSource).toContain("Open your bank before syncing when gear should change the trip.");
    expect(pageSource).not.toContain("Sync found? Pick a route.");
    expect(pageSource).not.toContain("POST_SYNC_ACTIONS");
    expect(pageSource).toContain("Privacy and fixes");
    expect(pageSource).toContain("RuneLite adds");
    expect(pageSource).toContain("Never reads");
    expect(pageSource).toContain("No credentials");
    expect(pageSource).toContain("Nothing showing?");
    expect(pageSource).not.toContain("After a successful sync");
    expect(pageSource).not.toContain("Turn sync into the next thing to do.");
  });

  it("offers a RuneLite open button without pretending browser search is guaranteed", () => {
    const source = readFileSync(join(process.cwd(), "src/components/runelite-open-button.tsx"), "utf8");

    expect(source).toContain('const PLUGIN_SEARCH = "Scapestack Sync"');
    expect(source).toContain('const RUNELITE_PROTOCOL_URL = "runelite://"');
    expect(source).toContain('const RUNELITE_PLUGIN_HUB_URL = "https://runelite.net/plugin-hub/show/scapestack-sync"');
    expect(source).toContain("window.location.href = RUNELITE_PROTOCOL_URL");
    expect(source).toContain("Opening RuneLite. Plugin name copied.");
    expect(source).toContain("Copied. Search Plugin Hub for Scapestack Sync.");
    expect(source).toContain("Plugin Hub page");
    expect(source).not.toContain("Copy scapestack.org sync URL");
    expect(source).not.toContain("PUBLIC_SYNC_URL");
    expect(source).not.toContain("Automatically installs");
  });

  it("does not render Plugin Hub PR or reviewer workflow copy on the player plugin page", () => {
    const pageSource = readFileSync(join(process.cwd(), "src/app/plugin/page.tsx"), "utf8");

    expect(pageSource).not.toContain("getPluginHubStatus");
    expect(pageSource).not.toContain("pluginHubReviewReadiness");
    expect(pageSource).not.toContain("Plugin Hub PR");
    expect(pageSource).not.toContain("Track Plugin Hub review");
    expect(pageSource).not.toContain("review-readiness");
    expect(pageSource).not.toContain("PR body");
    expect(pageSource).not.toContain("reviewer packet");
    expect(pageSource).not.toContain("Maintainer review");
    expect(pageSource).not.toContain("Developer / tester install");
    expect(pageSource).not.toContain("developer-install");
  });

  it("uses stable plugin hero CTAs for the product flow", () => {
    expect(pluginHeroActions()).toEqual([
      {
        id: "verify",
        label: "Check RuneLite",
        href: "#verify-sync",
        kind: "primary"
      },
      {
        id: "next",
        label: "Open one plan",
        href: "/next?from=plugin&bank=none",
        kind: "secondary",
        usesNextHandoff: true
      }
    ]);
  });

  it("keeps plugin page return context for /next refresh flows", () => {
    const context = pluginContextFromSearchParams({
      from: "next",
      rsn: "Lynx Titan",
      bank: "none"
    });

    expect(context).toEqual({
      title: "Back to your trip",
      body: "Sync RuneLite, then reopen the plan so finished progress disappears.",
      cta: "Back to plan",
      href: "/next?rsn=Lynx+Titan&bank=none&from=plugin"
    });
    expect(context?.href).not.toContain("source=plugin-sync");
  });

  it("preserves bankless return context for other plugin handoffs", () => {
    const context = pluginContextFromSearchParams({
      from: "slayer",
      rsn: "Lynx Titan",
      bank: "none"
    });

    expect(context).toMatchObject({
      title: "Back to Slayer",
      body: "Sync RuneLite, then return with stale progress removed.",
      cta: "Return to Slayer",
      href: "/slayer?rsn=Lynx+Titan&bank=none&from=plugin"
    });
  });

  it("returns profile handoffs to the player profile route", () => {
    const context = pluginContextFromSearchParams({
      from: "profile",
      rsn: "Lynx Titan",
      bank: "none"
    });

    expect(context).toEqual({
      title: "Back to profile",
      body: "Sync RuneLite, then return with finished progress removed.",
      cta: "Return to profile",
      href: "/u/Lynx%20Titan?from=plugin&bank=none"
    });
  });

  it("does not tell players that enabling the plugin alone is enough to sync", () => {
    const checkerSource = readFileSync(join(process.cwd(), "src/components/plugin-sync-checker.tsx"), "utf8");
    const diagnosticsSource = readFileSync(join(process.cwd(), "src/lib/plugin-sync-diagnostics.ts"), "utf8");

    expect(checkerSource).not.toContain("plugin enabled, confirm the Sync URL");
    expect(checkerSource).not.toContain("if this finds your RSN, /next can use exact account state");
    expect(diagnosticsSource).not.toContain("Scapestack Sync enabled.");
    expect(diagnosticsSource).toContain("Enable “Sync on login”");
    expect(checkerSource).toContain("RuneLite helps Scapestack skip stuff you already finished.");
    expect(checkerSource).toContain("RuneLite is helping {foundDisplayName}");
    expect(checkerSource).toContain("Open one plan that skips finished quests");
    expect(checkerSource).toContain("Slayer task ready");
    expect(checkerSource).not.toContain("Sync details");
    expect(checkerSource).not.toContain("/next sync signals");
    expect(checkerSource).not.toContain("Session action queue");
    expect(checkerSource).not.toContain("actionQueueForSyncedPlayer");
    expect(checkerSource).not.toContain("syncUrlsForOrigin(syncOrigin)");
    expect(checkerSource).not.toContain("LOCAL_SYNC_URL");
    expect(checkerSource).not.toContain("LOCAL_SYNC_CLAIM_URL");
    expect(diagnosticsSource).toContain("Press Sync now, then check this RSN again.");
    expect(diagnosticsSource).toContain("Enable “Sync on login”");
  });

  it("keeps synced player success as status and next action only", () => {
    const checkerSource = readFileSync(join(process.cwd(), "src/components/plugin-sync-checker.tsx"), "utf8");

    expect(checkerSource).toContain("Open one plan");
    expect(checkerSource).toContain("Check again");
    expect(checkerSource).toContain("Last press {syncAgeLabel(state.player.syncedAt)}");
    expect(checkerSource).not.toContain("formatPluginSyncProof");
    expect(checkerSource).not.toContain("Copy proof");
    expect(checkerSource).not.toContain("Proof copied");
    expect(checkerSource).not.toContain("Clipboard failed — copy sync proof manually");
    expect(checkerSource).not.toContain("Manual sync proof fallback for");
  });

  it("keeps the plugin page from rendering bank handoff UI", () => {
    const pageSource = readFileSync(join(process.cwd(), "src/app/plugin/page.tsx"), "utf8");
    const bannerSource = readFileSync(join(process.cwd(), "src/components/plugin-bank-handoff-banner.tsx"), "utf8");

    expect(pageSource).not.toContain("PluginBankHandoffBanner");
    expect(bannerSource).toContain("clearBankHandoffPayload(window)");
    expect(bannerSource).toContain("Clear bank");
    expect(bannerSource).toContain("Bank added");
    expect(bannerSource).toContain("What sync can add");
    expect(bannerSource).toContain("This browser bank never goes back to RuneLite.");
    expect(bannerSource).toContain("Plugin bank sync is a separate opt-in");
  });
});
