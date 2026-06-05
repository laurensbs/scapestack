import { describe, expect, it } from "vitest";
import { bankToolUrl, toolHandoffUrl } from "@/lib/bank-tool-routes";

describe("bank tool routes", () => {
  it("carries the bank RSN into downstream tools", () => {
    expect(bankToolUrl("/next", " Lynx Titan ")).toBe("/next?rsn=Lynx+Titan&from=bank");
    expect(bankToolUrl("/goals", " Lynx Titan ")).toBe("/goals?rsn=Lynx+Titan&from=bank");
    expect(bankToolUrl("/slayer", " Lynx Titan ")).toBe("/slayer?rsn=Lynx+Titan&from=bank");
  });

  it("keeps the bank handoff marker when the RSN is unknown", () => {
    expect(bankToolUrl("/dps", "")).toBe("/dps?from=bank");
  });

  it("carries a selected bank boss into DPS handoff", () => {
    expect(bankToolUrl("/dps", " Lynx Titan ", { boss: "kalphite-queen" }))
      .toBe("/dps?rsn=Lynx+Titan&from=bank&boss=kalphite-queen");
    expect(toolHandoffUrl("/dps", "bank", null, { boss: " Vardorvis " }))
      .toBe("/dps?from=bank&boss=Vardorvis");
    expect(toolHandoffUrl("/next", "bank", null, { boss: "vardorvis" }))
      .toBe("/next?from=bank");
  });

  it("routes plugin verification to the sync anchor", () => {
    expect(bankToolUrl("/plugin", " Lynx Titan ")).toBe("/plugin?rsn=Lynx+Titan&from=bank#verify-sync");
  });

  it("carries the active RSN from /next into follow-up tools", () => {
    expect(toolHandoffUrl("/dps", "next", " Lynx Titan ")).toBe("/dps?rsn=Lynx+Titan&from=next");
    expect(toolHandoffUrl("/goals", "next", " Lynx Titan ")).toBe("/goals?rsn=Lynx+Titan&from=next");
    expect(toolHandoffUrl("/slayer", "next", " Lynx Titan ")).toBe("/slayer?rsn=Lynx+Titan&from=next");
    expect(toolHandoffUrl("/plugin", "next", " Lynx Titan ")).toBe("/plugin?rsn=Lynx+Titan&from=next#verify-sync");
    expect(toolHandoffUrl("/plugin", "next", " Lynx Titan ", { hasBankContext: false }))
      .toBe("/plugin?rsn=Lynx+Titan&from=next&bank=none#verify-sync");
  });

  it("supports profile-to-tool handoffs after opening a player page", () => {
    expect(toolHandoffUrl("/next", "profile", " Lynx Titan ")).toBe("/next?rsn=Lynx+Titan&from=profile");
    expect(toolHandoffUrl("/plugin", "profile", " Lynx Titan ")).toBe("/plugin?rsn=Lynx+Titan&from=profile#verify-sync");
  });

  it("supports tool-to-tool handoff sources and explicit bankless context", () => {
    expect(toolHandoffUrl("/next", "goals", " Lynx Titan ")).toBe("/next?rsn=Lynx+Titan&from=goals");
    expect(toolHandoffUrl("/dps", "goals", " Lynx Titan ", { hasBankContext: false }))
      .toBe("/dps?rsn=Lynx+Titan&from=goals&bank=none");
    expect(toolHandoffUrl("/slayer", "dps", null, { hasBankContext: false }))
      .toBe("/slayer?from=dps&bank=none");
  });
});
