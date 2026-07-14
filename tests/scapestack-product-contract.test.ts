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
    expect(homepage).toContain("HeroBossTripPreview");
    expect(homepage).not.toContain("Quest readiness");
    expect(homepage).not.toContain("Bank gaps");
    expect(homepage).not.toContain("Unlock board");
    expect(homepage).not.toContain("Know what to do next");
    expect(homepage).not.toContain("Which level, quest or item is stopping me?");
    expect(homepage).not.toContain("Every panel must earn the click");
    expect(homepage).not.toContain("Progression lanes");
    expect(homepage).not.toContain("Every panel answers a player question");
    expect(next).toContain("Next trip");
    expect(next).toContain("function NextTripCard");
    expect(next).toContain('data-next-trip-card="true"');
    expect(next).toContain('label: "Before you leave"');
    expect(next).toContain('label: accountMode.type === "ultimate" ? "Stage for UIM" : "Grab from bank"');
    expect(next).toContain('label: "Still missing"');
    expect(next).toContain('label: "Finish after"');
    expect(next).toContain("Start this trip");
    expect(next).not.toContain("Session board");
    expect(next).not.toContain("Main move");
    expect(next).not.toContain("One move, two backups, the prep, blockers, bank signal and stop point.");
    expect(next).not.toContain("Find unlock");
    expect(next).not.toContain("Nothing obvious");
    expect(next).toContain("Open unlocks");
    expect(next).toContain("function NextTripContextLine");
    expect(next).toContain("Since last check");
    expect(next).toContain("RouteCard");
    expect(next).toContain("data-route-card");
    expect(next).toContain("RoutePrimarySprite");
    expect(next).toContain("routeCardStatusLabel");
    expect(next).toContain("data-route-item-id");
    expect(next).not.toContain("{sprite.type === \"boss\" ? `boss:${sprite.slug}` : `id:${sprite.itemId}`}");
    expect(next).not.toContain("Worth it because");
    expect(next).not.toContain('label="Do"');
    expect(next).not.toContain('label="Bring/check"');
    expect(next).not.toContain('label="Stop when"');
    expect(next).not.toContain("First step, then what logically follows.");
    expect(next).not.toContain("First this");
    expect(next).not.toContain("After that");
    expect(next).toContain("Pick today&apos;s trip");
    expect(next).not.toContain("Another route");
    expect(next).toContain("Not this one?");
    expect(next).toContain("<summary className=\"inline-flex cursor-pointer list-none items-center gap-1.5");
    expect(next).toContain("const activePick = useMemo(() =>");
    expect(next).toContain("const fallbackRecs = activePick ? activePick.alternatives.slice(0, 2) : [];");
    expect(next).not.toContain("Backup moves");
    expect(next).not.toContain("Use these when the main move is blocked or not the session you want.");
    expect(next).not.toContain("Backups");
    expect(next).not.toContain("Bigger alternatives if the first pick is not your mood.");
    expect(next).not.toContain("Want something else?");
    expect(next).not.toContain('aria-label="Randomize another OSRS plan"');
    expect(next).not.toContain("More unlock moves and routes");
    expect(next).toContain("More routes");
    expect(next).toContain("Closest unlocks");
    expect(next).toContain("Routes to inspect");
    expect(next).toContain("Why this trip?");
    expect(next).toContain("Unlock gaps");
    expect(next).not.toContain("Why is this recommended?");
    expect(next).not.toContain("Next best actions");
    expect(next).not.toContain("Specific unlock moves");
    expect(next).not.toContain("Where you are");
    expect(next).not.toContain("Add supplies if needed");
    expect(next).not.toContain("Next sessions");
    expect(next).not.toContain("Try another");
    expect(next).not.toContain("Try a different route");
    expect(next).not.toContain("Change time or pace");
    expect(next).toContain("Not picked");
    expect(next).not.toContain("Show exact items");
    expect(next).not.toContain("What do I need?");
    expect(next).not.toContain("Build trip");
    expect(next).not.toContain("Copy Bank Tag");
    expect(next).not.toContain("Trip looks runnable");
    expect(next).not.toContain("Safer backup");
    expect(next).not.toContain("Screenshot mode");
    expect(next).not.toContain("Copy plan");
    expect(next).toContain("Last RuneLite scan:");
    expect(next).toContain("Next trip");
    expect(next).toContain("Chill now");
    expect(next).toContain("accountStage={summary.accountStage}");
    expect(next).not.toContain("Bossing stays backup while this route has the cleaner stop point.");
    expect(plugin).toContain("Skip done stuff.");
    expect(plugin).toContain("No login");
    expect(plugin).toContain("Bank can be turned off");
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
    expect(playerFacingSources).toContain("Finished quests, diary steps, clog slots and Slayer mistakes are skipped.");
    expect(playerFacingSources).toContain("Last RuneLite scan:");
    expect(playerFacingSources).toContain("RuneLite can improve picks later.");
    expect(playerFacingSources).toContain("Check RuneLite");
    expect(playerFacingSources).not.toContain("Open synced /next");
    expect(playerFacingSources).not.toContain("Verified RuneLite payload");
  });
});
