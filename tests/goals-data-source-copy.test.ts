import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/goals/goals-client.tsx"), "utf8");

describe("Goals unlock companion", () => {
  it("opens on one account-specific unlock without overview metrics", () => {
    expect(source).toContain("Unlock this next");
    expect(source).toContain("Best next unlock");
    expect(source).toContain("One reward worth chasing now");
    expect(source).toContain("Start:");
    expect(source).toContain("Stop:");
    expect(source).not.toContain("rewards found");
    expect(source).not.toContain("Untradeable progress");
    expect(source).not.toContain("Add more context");
    expect(source).not.toContain("Bank rewards are ticked from the items you pasted");
    expect(source).not.toContain("ScapestackReadinessRail");
  });

  it("keeps the unlock browser optional, searchable and keyboard-readable", () => {
    expect(source).toContain("Browse other unlocks");
    expect(source).toContain("aria-expanded={browserOpen}");
    expect(source).toContain('htmlFor="goals-search"');
    expect(source).toContain('aria-describedby="goals-search-status"');
    expect(source).toContain('role="status"');
    expect(source).toContain('htmlFor="goal-category"');
    expect(source).toContain("function UnlockBrowserTile");
    expect(source).toContain("aria-pressed={selected}");
  });

  it("uses one focused unlock dialog instead of nested status panels", () => {
    expect(source).toContain("function GoalUnlockModal");
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain("Why it matters");
    expect(source).toContain("Do this");
    expect(source).toContain("Reward path");
    expect(source).toContain("Before you start:");
    expect(source).toContain("Not confirmed yet — tap when done");
    expect(source).not.toContain("Tick off missing bits");
    expect(source).not.toContain("Already checked");
  });

  it("persists account-scoped choices and sends the chosen reward to /next", () => {
    expect(source).toContain("goalManualChecksStorageKey(activeRsn)");
    expect(source).toContain("goalSelectionStorageKey(activeRsn)");
    expect(source).toContain("persistActiveGoalRoute(window.localStorage, activeRsn");
    expect(source).toContain("Make this my route");
    expect(source).toContain("goalRouteHref");
  });

  it("keeps account-aware OSRS guidance in the focused route", () => {
    expect(source).toContain("function unlockRequirementLine");
    expect(source).toContain("higher tiers cover the earlier rewards");
    expect(source).toContain("Normal Void first");
    expect(source).toContain("Elite Void upgrades the ranged and magic body pieces");
    expect(source).toContain("Open Check kill before chasing");
    expect(source).toContain("A higher-tier reward already covers the lower tiers.");
  });
});
