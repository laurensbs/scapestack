import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/goals/goals-client.tsx"), "utf8");

describe("Goals data source copy", () => {
  it("explains which goal progress comes from bank, Hiscores and RuneLite sync", () => {
    expect(source).toContain("Bank-owned untradeables are checked from item IDs");
    expect(source).toContain("earned skill capes can come from Hiscores");
    expect(source).toContain("RuneLite can help later when diary rewards, quest rewards or clog-only goals would change the route");
    expect(source).not.toContain("Untradeable sets, capes and milestone items are being checked against this bank context.");
  });

  it("keeps the goals filters clear, clickable and screen-reader readable", () => {
    expect(source).toContain('htmlFor="goals-search"');
    expect(source).toContain('aria-describedby="goals-search-help goals-search-status"');
    expect(source).toContain("Type a set, item or activity name to filter goal cards.");
    expect(source).toContain('aria-label="Clear goals search"');
    expect(source).toContain("aria-pressed={active === opt.id}");
    expect(source).toContain("aria-haspopup=\"menu\"");
    expect(source).toContain('role="menu"');
    expect(source).toContain('role="menuitemradio"');
    expect(source).toContain("aria-checked={active === cat}");
  });

  it("makes each goal card expansion control explicit", () => {
    expect(source).toContain("const panelId = `goal-set-panel-${set.id}`;");
    expect(source).toContain("aria-expanded={expanded}");
    expect(source).toContain("aria-controls={panelId}");
    expect(source).toContain('aria-label={`${expanded ? "Hide" : "Show"} ${set.name} goal details`}');
    expect(source).toContain("<div id={panelId}");
  });

  it("opens with a companion-style next unlock instead of a status dashboard", () => {
    expect(source).toContain("function NextUnlockCompanion");
    expect(source).toContain("Pick an unlock");
    expect(source).toContain("Next unlock");
    expect(source).toContain("Already got");
    expect(source).toContain("Next missing");
    expect(source).toContain("Counts through");
    expect(source).toContain("Finish this");
    expect(source).toContain("Local checklist");
    expect(source).toContain("GOAL_CHECK_STORAGE_KEY");
    expect(source).toContain("Higher-tier rewards already tick lower tiers.");
    expect(source).toContain("Almost there");
    expect(source).toContain("Make unlocks sharper");
    expect(source).not.toContain("Make this unlock route sharper");
    expect(source).not.toContain("Closest to complete");
  });

  it("deepens the unlock companion with route guidance instead of panels", () => {
    expect(source).toContain("function whyThisUnlock");
    expect(source).toContain("function sourceHintForGoal");
    expect(source).toContain("function unlockPlanSteps");
    expect(source).toContain("Do this next");
    expect(source).toContain("Why:");
    expect(source).toContain("Wiki");
    expect(source).toContain("Claim from the diary NPC");
    expect(source).toContain("Needs the Void pieces plus the Western Provinces diary gate.");
    expect(source).toContain("Open Check kill before chasing");
    expect(source).toContain("Higher diary rewards count the lower tiers automatically.");
  });
});
