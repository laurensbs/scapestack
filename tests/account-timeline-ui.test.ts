import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("shared account timeline UI", () => {
  it("keeps full history off home while reusing it on profile and next", () => {
    const home = readFileSync("src/app/page.tsx", "utf8");
    const hero = readFileSync("src/components/hero-intake.tsx", "utf8");
    const profile = readFileSync("src/app/u/[rsn]/page.tsx", "utf8");
    const next = readFileSync("src/app/next/next-client.tsx", "utf8");

    expect(home).not.toContain("<AccountTimeline");
    expect(hero).toContain('data-return-home="true"');
    expect(hero).toContain('fetch("/api/account/timeline?limit=10"');
    expect(profile).toContain("<AccountTimeline expectedRsn={hi.name}");
    expect(next).toContain("<AccountTimeline expectedRsn={activeRsn}");
    expect(profile).not.toContain("<WeeklyRecap");
    expect(next).not.toContain("JourneyRecapCard");
  });

  it("renders nothing for empty history and keeps technical copy out of the player surface", () => {
    const source = readFileSync("src/components/account-timeline.tsx", "utf8");
    expect(source).toContain("if (visible.length === 0) return null");
    expect(source).toContain("Since last time");
    expect(source).not.toMatch(/>[^<{]*(payload|signals|data source|reconciliation)[^<{]*</i);
  });

  it("checks the connected account before requesting private history", () => {
    const source = readFileSync("src/components/account-timeline.tsx", "utf8");
    expect(source.indexOf('fetch("/api/account/me"')).toBeLessThan(source.indexOf('fetch(`/api/account/timeline?'));
    expect(source).toContain("if (!session.connected) return null");
  });
});
