import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PUBLIC_SYNC_URL } from "@/lib/plugin-sync-actions";
import { pluginContextFromSearchParams, pluginHeroActions } from "@/app/plugin/page";

describe("plugin page copy constants", () => {
  it("keeps the player sync flow focused on RSN, .org sync and next actions", () => {
    const pageSource = readFileSync(join(process.cwd(), "src/app/plugin/page.tsx"), "utf8");

    expect(PUBLIC_SYNC_URL).toBe("https://www.scapestack.org/api/sync");
    expect(pageSource).toContain("Check RuneLite sync.");
    expect(pageSource).toContain("Then open one plan.");
    expect(pageSource).toContain("Check sync");
    expect(pageSource).toContain("Plan next move");
    expect(pageSource).toContain("Setup help");
    expect(pageSource).toContain("RuneLite sync link");
    expect(pageSource).toContain(PUBLIC_SYNC_URL);
    expect(pageSource).not.toContain("scapestack.app");
    expect(pageSource).toContain("PluginSyncChecker");
    expect(pageSource).toContain("Plan next move");
    expect(pageSource).not.toContain("Sync found? Pick a route.");
    expect(pageSource).not.toContain("POST_SYNC_ACTIONS");
    expect(pageSource).toContain("Privacy and fixes");
    expect(pageSource).toContain("Sync uses");
    expect(pageSource).toContain("Never uses");
    expect(pageSource).toContain("No credentials");
    expect(pageSource).toContain("Nothing showing?");
    expect(pageSource).not.toContain("After a successful sync");
    expect(pageSource).not.toContain("Turn sync into the next thing to do.");
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
        label: "Check sync",
        href: "#verify-sync",
        kind: "primary"
      },
      {
        id: "next",
        label: "Plan next move",
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
      title: "From /next",
      body: "Check sync, then return to your plan.",
      cta: "Return to /next",
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

    expect(context?.href).toBe("/slayer?rsn=Lynx+Titan&bank=none&from=plugin");
  });

  it("returns profile handoffs to the player profile route", () => {
    const context = pluginContextFromSearchParams({
      from: "profile",
      rsn: "Lynx Titan",
      bank: "none"
    });

    expect(context).toEqual({
      title: "From profile",
      body: "Check sync, then return.",
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
    expect(diagnosticsSource).toContain("Enable “Auto-sync on login”");
    expect(checkerSource).toContain("Sync helps /next skip stuff you already finished.");
    expect(checkerSource).toContain("Sync found for {foundDisplayName}");
    expect(checkerSource).toContain("Open /next for one plan that skips finished quests");
    expect(checkerSource).toContain("Slayer task ready");
    expect(checkerSource).not.toContain("Sync details");
    expect(checkerSource).not.toContain("/next sync signals");
    expect(checkerSource).not.toContain("Session action queue");
    expect(checkerSource).not.toContain("actionQueueForSyncedPlayer");
    expect(checkerSource).toContain("syncUrlsForOrigin(syncOrigin)");
    expect(checkerSource).not.toContain("LOCAL_SYNC_URL");
    expect(checkerSource).not.toContain("LOCAL_SYNC_CLAIM_URL");
    expect(diagnosticsSource).toContain("Use https://www.scapestack.org/api/sync");
    expect(diagnosticsSource).toContain("Enable “Auto-sync on login”");
  });

  it("keeps synced player success as status and next action only", () => {
    const checkerSource = readFileSync(join(process.cwd(), "src/components/plugin-sync-checker.tsx"), "utf8");

    expect(checkerSource).toContain("Open /next");
    expect(checkerSource).toContain("Check again");
    expect(checkerSource).toContain("Synced {syncAgeLabel(state.player.syncedAt)}");
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
    expect(bannerSource).toContain("Bank loaded");
    expect(bannerSource).toContain("What sync can add");
    expect(bannerSource).toContain("The plugin never receives your bank, inventory, equipment, screenshots, clicks or account login.");
  });
});
