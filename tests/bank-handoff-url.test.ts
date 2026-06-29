import { describe, expect, it } from "vitest";
import { bankOrganizerHref } from "@/lib/bank-handoff-url";

describe("bank handoff URLs", () => {
  it("carries RSN and source surface into bank upload", () => {
    expect(bankOrganizerHref(" Lynx Titan ", "profile")).toBe("/bank?rsn=Lynx+Titan&from=profile");
  });

  it("keeps a source marker even without RSN", () => {
    expect(bankOrganizerHref("", "next")).toBe("/bank?from=next");
  });

  it("supports returning from downstream bank-aware tools", () => {
    expect(bankOrganizerHref("Lynx Titan", "dps")).toBe("/bank?rsn=Lynx+Titan&from=dps");
    expect(bankOrganizerHref(null, "slayer")).toBe("/bank?from=slayer");
  });

  it("keeps a selected DPS boss while adding setup", () => {
    expect(bankOrganizerHref("Lynx Titan", "dps", { boss: "vardorvis" }))
      .toBe("/bank?rsn=Lynx+Titan&from=dps&boss=vardorvis");
    expect(bankOrganizerHref(null, "dps", { boss: "zulrah" }))
      .toBe("/bank?from=dps&boss=zulrah");
    expect(bankOrganizerHref("Lynx Titan", "next", { boss: "vardorvis" }))
      .toBe("/bank?rsn=Lynx+Titan&from=next");
  });
});
