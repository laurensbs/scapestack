import { describe, expect, it } from "vitest";
import { contextualNavHref } from "@/lib/nav-context";

describe("contextualNavHref", () => {
  it("carries RSN and bankless context from Goals into primary nav tools", () => {
    const query = "rsn=Lynx+Titan&from=next&bank=none";

    expect(contextualNavHref("/next", "/goals", query))
      .toBe("/next?rsn=Lynx+Titan&from=goals&bank=none");
    expect(contextualNavHref("/dps", "/goals", query))
      .toBe("/dps?rsn=Lynx+Titan&from=goals&bank=none");
    expect(contextualNavHref("/slayer", "/goals", query))
      .toBe("/slayer?rsn=Lynx+Titan&from=goals&bank=none");
  });

  it("links plugin nav to the verification handoff for the active RSN", () => {
    expect(contextualNavHref("/plugin", "/slayer", "rsn=Lynx+Titan"))
      .toBe("/plugin?rsn=Lynx+Titan&from=slayer#verify-sync");
  });

  it("keeps plugin-sync /next navigation bankless", () => {
    const query = "rsn=Lynx+Titan&source=plugin-sync&bank=none";

    expect(contextualNavHref("/goals", "/next", query))
      .toBe("/goals?rsn=Lynx+Titan&from=next&bank=none");
    expect(contextualNavHref("/dps", "/next", query))
      .toBe("/dps?rsn=Lynx+Titan&from=next&bank=none");
    expect(contextualNavHref("/plugin", "/next", query))
      .toBe("/plugin?rsn=Lynx+Titan&from=next&bank=none#verify-sync");
  });

  it("leaves non-context routes unchanged", () => {
    expect(contextualNavHref("/", "/goals", "rsn=Lynx+Titan")).toBe("/");
    expect(contextualNavHref("/bank", "/goals", "rsn=Lynx+Titan")).toBe("/bank");
  });

  it("uses the active account on tool nav outside handoff pages", () => {
    expect(contextualNavHref("/dps", "/", "rsn=Lynx+Titan")).toBe("/dps?rsn=Lynx+Titan");
  });
});
