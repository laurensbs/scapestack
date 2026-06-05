import { describe, expect, it } from "vitest";
import {
  DB_INIT_COMMAND,
  isPluginSyncSource,
  LOCAL_SYNC_CLAIM_URL,
  LOCAL_SYNC_URL,
  nextUrlFromPluginSearch,
  nextUrlForSyncedRsn,
  pluginVerifyUrlForSyncedRsn,
  PUBLIC_SYNC_CLAIM_URL,
  PUBLIC_SYNC_URL,
  slayerUrlForSyncedRsn,
  syncUrlsForOrigin
} from "@/lib/plugin-sync-actions";

describe("plugin sync actions", () => {
  it("builds a /next URL that auto-runs the synced RSN", () => {
    expect(nextUrlForSyncedRsn(" Lynx Titan ")).toBe("/next?rsn=Lynx+Titan&source=plugin-sync&bank=none");
  });

  it("builds neutral /next CTA URLs from the plugin page search params", () => {
    expect(nextUrlFromPluginSearch("?rsn=Lynx+Titan&from=goals")).toBe("/next?rsn=Lynx+Titan&from=plugin&bank=none");
    expect(nextUrlFromPluginSearch("?from=goals")).toBe("/next?from=plugin&bank=none");
    expect(nextUrlFromPluginSearch("?rsn=Lynx+Titan&from=goals")).not.toContain("source=plugin-sync");
  });

  it("keeps plugin /next CTAs bank-aware without claiming verified sync", () => {
    expect(nextUrlFromPluginSearch("?rsn=Lynx+Titan&from=bank", { hasBankContext: true }))
      .toBe("/next?rsn=Lynx+Titan&from=plugin");
    expect(nextUrlFromPluginSearch("?from=bank", { hasBankContext: true }))
      .toBe("/next?from=plugin");
  });

  it("builds a /slayer URL that auto-runs the synced RSN", () => {
    expect(slayerUrlForSyncedRsn(" Lynx Titan ")).toBe("/slayer?rsn=Lynx+Titan&source=plugin-sync&bank=none");
  });

  it("builds a /plugin verify URL that carries the same RSN", () => {
    expect(pluginVerifyUrlForSyncedRsn(" Lynx Titan ")).toBe("/plugin?rsn=Lynx+Titan&from=bank#verify-sync");
    expect(pluginVerifyUrlForSyncedRsn(" Lynx Titan ", "next")).toBe("/plugin?rsn=Lynx+Titan&from=next#verify-sync");
    expect(pluginVerifyUrlForSyncedRsn(" Lynx Titan ", "next", { hasBankContext: false }))
      .toBe("/plugin?rsn=Lynx+Titan&from=next&bank=none#verify-sync");
  });

  it("keeps source marker even when RSN is empty", () => {
    expect(nextUrlForSyncedRsn(" ")).toBe("/next?source=plugin-sync&bank=none");
    expect(slayerUrlForSyncedRsn(" ")).toBe("/slayer?source=plugin-sync&bank=none");
    expect(pluginVerifyUrlForSyncedRsn(" ")).toBe("/plugin?from=bank#verify-sync");
  });

  it("detects plugin sync source markers exactly", () => {
    expect(isPluginSyncSource("plugin-sync")).toBe(true);
    expect(isPluginSyncSource("bank")).toBe(false);
    expect(isPluginSyncSource(null)).toBe(false);
  });

  it("exposes public Plugin Hub and local developer sync commands separately", () => {
    expect(PUBLIC_SYNC_URL).toBe("https://www.scapestack.org/api/sync");
    expect(PUBLIC_SYNC_CLAIM_URL).toBe("https://www.scapestack.org/api/sync/claim");
    expect(LOCAL_SYNC_URL).toBe("http://127.0.0.1:4173/api/sync");
    expect(LOCAL_SYNC_CLAIM_URL).toBe("http://127.0.0.1:4173/api/sync/claim");
    expect(DB_INIT_COMMAND).toBe("npm run db:init");
  });

  it("derives copyable sync endpoints from the active browser origin", () => {
    expect(syncUrlsForOrigin("http://127.0.0.1:4173/plugin")).toEqual({
      sync: LOCAL_SYNC_URL,
      claim: LOCAL_SYNC_CLAIM_URL
    });
    expect(syncUrlsForOrigin("https://preview.scapestack.org/plugin?rsn=Lynx")).toEqual({
      sync: "https://preview.scapestack.org/api/sync",
      claim: "https://preview.scapestack.org/api/sync/claim"
    });
    expect(syncUrlsForOrigin(null)).toEqual({
      sync: PUBLIC_SYNC_URL,
      claim: PUBLIC_SYNC_CLAIM_URL
    });
    expect(syncUrlsForOrigin("ftp://127.0.0.1")).toEqual({
      sync: PUBLIC_SYNC_URL,
      claim: PUBLIC_SYNC_CLAIM_URL
    });
  });
});
