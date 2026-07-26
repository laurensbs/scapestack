import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/goals/goals-client.tsx"), "utf8");

describe("Goals unlock companion", () => {
  it("opens on one account-specific unlock without overview metrics", () => {
    expect(source).toContain("Unlock this next");
    expect(source).toContain("Best next unlock");
    expect(source).toContain("One reward worth chasing now");
    // See tests/trip-flow-contract.test.ts: the Start/Stop pair is a
    // two-column table now, so the labels are row headers.
    expect(source).toContain('<th scope="row" className="w-[64px]">Start</th>');
    expect(source).toContain('<th scope="row">Stop</th>');
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
    // Was `function UnlockBrowserTile`. The browser was a three-column grid of
    // 164px tiles and is a table now, for the same reason /dps stopped being a
    // grid of boss cards: the fraction that decides whether a set is worth
    // opening has to read down a column. The row still owns the pressed state,
    // which is what this case is really guarding.
    expect(source).toContain("function UnlockBrowserRow");
    expect(source).toContain('className="scape-table"');
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
