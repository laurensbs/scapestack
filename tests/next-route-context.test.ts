import { describe, expect, it } from "vitest";
import { shouldReadNextBankHandoff, shouldReadNextHeroBank } from "@/lib/next-route-context";

describe("next route context", () => {
  it("reads bank handoff only for real tool handoff routes", () => {
    expect(shouldReadNextBankHandoff("?from=bank")).toBe(true);
    expect(shouldReadNextBankHandoff("?from=profile&rsn=Lynx+Titan")).toBe(true);
    expect(shouldReadNextBankHandoff("?from=goals&rsn=Lynx+Titan")).toBe(true);
    expect(shouldReadNextBankHandoff("?from=plugin")).toBe(true);
    expect(shouldReadNextBankHandoff("?rsn=Lynx+Titan")).toBe(false);
    expect(shouldReadNextBankHandoff("?from=marketing&rsn=Lynx+Titan")).toBe(false);
  });

  it("does not read stale bank handoff when bank=none is explicit", () => {
    expect(shouldReadNextBankHandoff("?from=goals&rsn=Lynx+Titan&bank=none")).toBe(false);
    expect(shouldReadNextBankHandoff("?from=profile&rsn=Lynx+Titan&bank=none")).toBe(false);
    expect(shouldReadNextBankHandoff("rsn=Lynx+Titan&source=plugin-sync&bank=none")).toBe(false);
  });

  it("does not read hero-bank storage when bank=none is explicit", () => {
    expect(shouldReadNextHeroBank("?rsn=Lynx+Titan")).toBe(true);
    expect(shouldReadNextHeroBank("?rsn=Lynx+Titan&bank=none")).toBe(false);
  });
});
