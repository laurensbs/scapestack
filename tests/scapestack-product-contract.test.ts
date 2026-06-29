import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const playerFacingSources = [
  "src/app/page.tsx",
  "src/components/hero-intake.tsx",
  "src/app/next/next-client.tsx",
  "src/app/plugin/page.tsx",
  "src/components/plugin-sync-checker.tsx"
].map(read).join("\n");

describe("Scapestack anti-bankstanding product contract", () => {
  it("keeps the core promise simple and OSRS-native", () => {
    const homepage = read("src/app/page.tsx");
    const next = read("src/app/next/next-client.tsx");
    const plugin = read("src/app/plugin/page.tsx");
    const direction = read("docs/scapestack-product-direction.md");

    expect(homepage).toContain("Stop bankstanding.");
    expect(homepage).toContain("Pick the next trip.");
    expect(next).toContain("Do this first");
    expect(next).toContain("One best move for this account. Two backups");
    expect(next).toContain("After this run");
    expect(next).toContain("After this");
    expect(next).toContain("Pick a route");
    expect(next).toContain("Another route");
    expect(next).toContain("Backups");
    expect(next).not.toContain("Next sessions");
    expect(next).not.toContain("Try another");
    expect(next).not.toContain("Try a different route");
    expect(next).not.toContain("Change time or pace");
    expect(next).toContain("Not picked");
    expect(next).toContain("Build trip");
    expect(next).toContain("Copy Bank Tag");
    expect(next).not.toContain("Trip looks runnable");
    expect(next).not.toContain("Safer backup");
    expect(next).toContain("Screenshot mode");
    expect(next).toContain("Another trip");
    expect(next).toContain("Chill now");
    expect(next).toContain("accountStage={summary.accountStage}");
    expect(next).not.toContain("Bossing stays backup while this route has the cleaner stop point.");
    expect(plugin).toContain("Skip done stuff.");
    expect(plugin).toContain("No login");
    expect(plugin).toContain("No bank");
    expect(plugin).toContain("No screenshots");
    expect(direction).toContain("anti-bankstanding");
    expect(direction).toContain("one thing to do first");
    expect(direction).toContain("Critical Audit");
    expect(direction).toContain("First screenshot:");
    expect(direction).toContain("I built a RuneLite-powered tool");
    expect(direction).toContain("## Remove");
    expect(direction).toContain("## Missing");
  });

  it("keeps technical product language out of the player-facing planner flow", () => {
    const bannedPhrases = [
      "Plugin Hub PR",
      "Track Plugin Hub review",
      "signals",
      "payload",
      "exact account state",
      "data source",
      "Trust level",
      "What shaped this",
      "Used for this route",
      "How sure is it?",
      "Session action queue",
      "Sync details",
      "Scapestack readiness",
      "Check sync",
      "Bank + sync ready",
      "Bank loaded",
      "Sync database",
      "DATABASE_URL"
    ];

    for (const phrase of bannedPhrases) {
      expect(playerFacingSources).not.toContain(phrase);
    }
  });

  it("keeps RuneLite as quiet intelligence instead of the main task", () => {
    expect(playerFacingSources).toContain("RuneLite helps Scapestack skip stuff you already finished.");
    expect(playerFacingSources).toContain("Skips finished quests, diaries, clog slots and Slayer mistakes.");
    expect(playerFacingSources).toContain("RuneLite helped skip finished quests, diary steps, clog slots and Slayer mistakes.");
    expect(playerFacingSources).toContain("RuneLite can improve picks later.");
    expect(playerFacingSources).toContain("Check RuneLite");
    expect(playerFacingSources).not.toContain("Open synced /next");
    expect(playerFacingSources).not.toContain("Verified RuneLite payload");
  });
});
