import { describe, expect, it } from "vitest";
import { contextualNavHref } from "@/lib/nav-context";

describe("contextualNavHref", () => {
  it("keeps trip context and sends bank questions to profile anchors", () => {
    const query = "rsn=Lynx+Titan&from=next&bank=none";

    expect(contextualNavHref("/next", "/goals", query))
      .toBe("/next?rsn=Lynx+Titan&from=goals&bank=none");
    expect(contextualNavHref("/dps", "/goals", query))
      .toBe("/u/Lynx%20Titan#bosses");
    expect(contextualNavHref("/slayer", "/goals", query))
      .toBe("/u/Lynx%20Titan#task");
  });

  it("links plugin nav to the verification handoff for the active RSN", () => {
    expect(contextualNavHref("/plugin", "/slayer", "rsn=Lynx+Titan"))
      .toBe("/plugin?rsn=Lynx+Titan&from=slayer#verify-sync");
  });

  it("keeps plugin-sync /next navigation bankless", () => {
    const query = "rsn=Lynx+Titan&source=plugin-sync&bank=none";

    expect(contextualNavHref("/goals", "/next", query))
      .toBe("/u/Lynx%20Titan#sets");
    expect(contextualNavHref("/dps", "/next", query))
      .toBe("/u/Lynx%20Titan#bosses");
    expect(contextualNavHref("/plugin", "/next", query))
      .toBe("/plugin?rsn=Lynx+Titan&from=next&bank=none#verify-sync");
  });

  it("leaves unrelated routes unchanged and sends a known bank to its player", () => {
    expect(contextualNavHref("/", "/goals", "rsn=Lynx+Titan")).toBe("/");
    expect(contextualNavHref("/bank", "/goals", "rsn=Lynx+Titan")).toBe("/u/Lynx%20Titan#sets");
    expect(contextualNavHref("/bank", "/", "")).toBe("/bank");
  });

  it("uses the active account on tool nav outside handoff pages", () => {
    expect(contextualNavHref("/dps", "/", "rsn=Lynx+Titan")).toBe("/u/Lynx%20Titan#bosses");
  });
});
