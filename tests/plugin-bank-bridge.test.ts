import { describe, expect, it } from "vitest";
import { buildPluginBankBridgeActions, PLUGIN_BANK_SYNC_SIGNALS, PLUGIN_VERIFY_SYNC_HASH } from "@/lib/plugin-bank-bridge";

describe("plugin bank bridge", () => {
  it("keeps bank-origin users in a bank-aware loop without claiming verified sync", () => {
    expect(buildPluginBankBridgeActions()).toEqual([
      {
        id: "next",
        label: "Preview bank-aware /next",
        href: "/next?from=plugin",
        primary: true
      },
      {
        id: "dps",
        label: "Check bank DPS",
        href: "/dps?from=plugin",
        primary: false
      },
      {
        id: "slayer",
        label: "Plan Slayer",
        href: "/slayer?from=plugin",
        primary: false
      },
      {
        id: "sync",
        label: "Verify sync",
        href: `#${PLUGIN_VERIFY_SYNC_HASH}`,
        primary: false
      },
      {
        id: "bank",
        label: "Review bank",
        href: "/bank?from=plugin",
        primary: false
      }
    ]);
  });

  it("preserves RSN when bank context moves through plugin setup", () => {
    expect(buildPluginBankBridgeActions(" Lynx Titan ")).toEqual([
      {
        id: "next",
        label: "Preview bank-aware /next",
        href: "/next?rsn=Lynx+Titan&from=plugin",
        primary: true
      },
      {
        id: "dps",
        label: "Check bank DPS",
        href: "/dps?rsn=Lynx+Titan&from=plugin",
        primary: false
      },
      {
        id: "slayer",
        label: "Plan Slayer",
        href: "/slayer?rsn=Lynx+Titan&from=plugin",
        primary: false
      },
      {
        id: "sync",
        label: "Verify sync",
        href: `#${PLUGIN_VERIFY_SYNC_HASH}`,
        primary: false
      },
      {
        id: "bank",
        label: "Review bank",
        href: "/bank?rsn=Lynx+Titan&from=plugin",
        primary: false
      }
    ]);
    expect(buildPluginBankBridgeActions(" Lynx Titan ")[0].href).not.toContain("source=plugin-sync");
  });

  it("names the verified signals sync adds to bank-aware planning", () => {
    expect(PLUGIN_BANK_SYNC_SIGNALS.map((signal) => signal.id)).toEqual([
      "quests",
      "diaries",
      "collectionLog",
      "slayer"
    ]);
    expect(PLUGIN_BANK_SYNC_SIGNALS.map((signal) => signal.summary).join(" ")).toContain("Verified unlock checks");
    expect(PLUGIN_BANK_SYNC_SIGNALS.map((signal) => signal.summary).join(" ")).toContain("Verified diary tiers");
    expect(PLUGIN_BANK_SYNC_SIGNALS.map((signal) => signal.summary).join(" ")).not.toContain("Exact unlock checks");
    expect(PLUGIN_BANK_SYNC_SIGNALS.map((signal) => signal.detail).join(" ")).toContain("Stops /next from guessing");
  });
});
