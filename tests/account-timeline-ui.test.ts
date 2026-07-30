import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("shared account timeline UI", () => {
  it("keeps the timeline out of the consolidated player document", () => {
    const home = readFileSync("src/app/page.tsx", "utf8");
    const hero = readFileSync("src/components/hero-intake.tsx", "utf8");
    const profile = readFileSync("src/app/p/[rsn]/page.tsx", "utf8");
    const next = readFileSync("src/app/next/next-client.tsx", "utf8");

    expect(home).not.toContain("<AccountTimeline");
    expect(hero).not.toContain('data-return-home="true"');
    expect(hero).not.toContain('fetch("/api/account/timeline?limit=10"');
    expect(profile).not.toContain("<AccountTimeline");
    expect(next).not.toContain("<AccountTimeline");
    expect(profile).not.toContain("<WeeklyRecap");
    expect(next).not.toContain("JourneyRecapCard");
  });

  it("renders nothing for empty history and keeps technical copy out of the player surface", () => {
    const source = readFileSync("src/components/account-timeline.tsx", "utf8");
    expect(source).toContain("if (visible.length === 0) return null");
    expect(source).toContain("Since last time");
    expect(source).toContain('data-return-recap="true"');
    expect(source).toContain("<ItemSprite");
    expect(source).toContain("recap.nextAction");
    expect(source).toContain("Remind me tomorrow");
    expect(source).toContain("cancelReturnReminder");
    expect(source).toContain("requestReminderDelivery");
    expect(source).not.toMatch(/>[^<{]*(payload|signals|data source|reconciliation)[^<{]*</i);
  });

  it("checks the connected account before requesting private history", () => {
    const source = readFileSync("src/components/account-timeline.tsx", "utf8");
    expect(source.indexOf('fetch("/api/account/me"')).toBeLessThan(source.indexOf('fetch(`/api/account/timeline?'));
    expect(source).toContain("if (!session.connected) return null");
  });
});
