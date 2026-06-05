import { describe, expect, it } from "vitest";
import { getBankContextActions, type BankContextSource } from "@/components/bank-context-actions";

describe("getBankContextActions", () => {
  const sources: BankContextSource[] = ["next", "dps", "goals", "slayer"];

  it("always starts with the bank review action", () => {
    for (const source of sources) {
      expect(getBankContextActions(source)[0]).toEqual({
        id: "bank",
        href: `/bank?from=${source}`,
        label: "Review bank",
        primary: false
      });
    }
  });

  it("links to every other tool with the current source", () => {
    expect(getBankContextActions("dps").map((action) => action.href)).toEqual([
      "/bank?from=dps",
      "/next?from=dps",
      "/goals?from=dps",
      "/slayer?from=dps",
      "/plugin?from=dps#verify-sync"
    ]);
    expect(getBankContextActions("goals").map((action) => action.href)).toEqual([
      "/bank?from=goals",
      "/next?from=goals",
      "/dps?from=goals",
      "/slayer?from=goals",
      "/plugin?from=goals#verify-sync"
    ]);
    expect(getBankContextActions("slayer").map((action) => action.href)).toEqual([
      "/bank?from=slayer",
      "/next?from=slayer",
      "/dps?from=slayer",
      "/goals?from=slayer",
      "/plugin?from=slayer#verify-sync"
    ]);
  });

  it("preserves RSN across bank-context tool actions", () => {
    expect(getBankContextActions("goals", { rsn: " Lynx Titan " }).map((action) => action.href)).toEqual([
      "/bank?rsn=Lynx+Titan&from=goals",
      "/next?rsn=Lynx+Titan&from=goals",
      "/dps?rsn=Lynx+Titan&from=goals",
      "/slayer?rsn=Lynx+Titan&from=goals",
      "/plugin?rsn=Lynx+Titan&from=goals#verify-sync"
    ]);
  });

  it("marks links as bankless when the source only has Hiscores context", () => {
    expect(getBankContextActions("goals", {
      hasBankContext: false,
      rsn: "Lynx Titan"
    }).map((action) => action.href)).toEqual([
      "/bank?rsn=Lynx+Titan&from=goals",
      "/next?rsn=Lynx+Titan&from=goals&bank=none",
      "/dps?rsn=Lynx+Titan&from=goals&bank=none",
      "/slayer?rsn=Lynx+Titan&from=goals&bank=none",
      "/plugin?rsn=Lynx+Titan&from=goals&bank=none#verify-sync"
    ]);
  });

  it("adds a plugin verification action without making it the primary recommendation", () => {
    const plugin = getBankContextActions("dps", { rsn: "Lynx Titan" }).find((action) => action.id === "plugin");

    expect(plugin).toEqual({
      id: "plugin",
      href: "/plugin?rsn=Lynx+Titan&from=dps#verify-sync",
      label: "Verify sync",
      primary: false
    });
  });

  it("does not link the user back to the current tool", () => {
    for (const source of sources) {
      expect(getBankContextActions(source).some((action) => action.id === source)).toBe(false);
    }
  });
});
