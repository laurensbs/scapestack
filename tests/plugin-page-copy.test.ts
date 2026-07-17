import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pluginContextFromSearchParams, pluginHeroActions } from "@/app/plugin/page";

describe("plugin page copy constants", () => {
  it("keeps the player sync flow focused on the active account and one status", () => {
    const pageSource = readFileSync(join(process.cwd(), "src/app/plugin/page.tsx"), "utf8");

    expect(pageSource).toContain("Keep your next trip current.");
    expect(pageSource).toContain("Scapestack checks your active account automatically.");
    expect(pageSource).toContain("PluginSyncChecker");
    expect(pageSource).toContain("What RuneLite shares");
    expect(pageSource).toContain("optional bank stacks");
    expect(pageSource).toContain("Sync on login is optional and off by default.");
    expect(pageSource).toContain("Bank can be turned off at any time.");
    expect(pageSource).toContain("No RuneScape password, chat, screenshots, clicks, inventory or equipped items.");
    expect(pageSource).not.toContain("Setup help");
    expect(pageSource).not.toContain("Normal setup");
    expect(pageSource).not.toContain("PLAYER_SYNC_CHOICES");
    expect(pageSource).not.toContain("After Sync now");
    expect(pageSource).not.toContain("Privacy and fixes");
    expect(pageSource).not.toContain("Developer/self-hosting endpoint");
    expect(pageSource).not.toContain("Copy developer endpoint");
    expect(pageSource).not.toContain("PUBLIC_SYNC_URL");
    expect(pageSource).not.toContain("https://www.scapestack.org/api/sync");
    expect(pageSource).not.toContain("Copy sync URL");
    expect(pageSource).not.toContain("Scapestack link");
    expect(pageSource).not.toContain("scapestack.app");
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

  it("ties status to the active account and hides technical recovery", () => {
    const checkerSource = readFileSync(join(process.cwd(), "src/components/plugin-sync-checker.tsx"), "utf8");

    expect(checkerSource).toContain("getActiveAccount()?.rsn");
    expect(checkerSource).toContain("ACCOUNT_EVENT");
    expect(checkerSource).toContain('checkRsnValue(initialRsn, fromUrl ? "url" : active ? "active" : "saved")');
    expect(checkerSource).toContain("clearRuneliteChecked(clean)");
    expect(checkerSource).toContain("Technical troubleshooting");
    expect(checkerSource).toContain("Service setup is incomplete. This is not a RuneLite account problem.");
    expect(checkerSource).not.toContain("ServiceReadinessPill");
  });

  it("keeps a connected player on status, change, bank and next action only", () => {
    const checkerSource = readFileSync(join(process.cwd(), "src/components/plugin-sync-checker.tsx"), "utf8");

    expect(checkerSource).toContain("pluginConnectionView(state.player)");
    expect(checkerSource).toContain("{connection.scanLabel}");
    expect(checkerSource).toContain("{connection.changedLine}");
    expect(checkerSource).toContain("{connection.bankLine}");
    expect(checkerSource).toContain("Open next plan");
    expect(checkerSource).toContain("Check for a newer scan");
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
    expect(bannerSource).toContain("Plugin bank checks send item IDs, names and quantities only");
  });
});
