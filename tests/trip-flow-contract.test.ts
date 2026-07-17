import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe("trip flow contract", () => {
  it("keeps mobile content clear of the fixed action bar", () => {
    const layout = read("src/app/layout.tsx");
    const mobileBar = read("src/components/mobile-action-bar.tsx");
    const globals = read("src/app/globals.css");

    expect(layout).toContain("mobile-content-safe");
    expect(layout).toContain("mobile-footer-safe");
    expect(layout).toContain('<html lang="en" className="min-h-full">');
    expect(layout).toContain('<body className="min-h-full');
    expect(layout).not.toContain('<body className="h-full');
    expect(globals).toContain("overflow-x: clip;");
    expect(globals).toContain("height: auto;");
    expect(globals).toContain("--mobile-action-bar-height: 4.75rem;");
    expect(globals).toContain("env(safe-area-inset-bottom)");
    expect(mobileBar).toContain('label: "Trip"');
    expect(mobileBar).toContain('selected: pathname === "/next"');
    expect(mobileBar).toContain("complete: hasBank");
    expect(mobileBar).not.toContain("action.helper");
    expect(mobileBar).not.toContain('label: "Plan"');
  });

  it("makes Goals start from one unlock trip before showing more routes", () => {
    const goals = read("src/app/goals/goals-client.tsx");

    expect(goals).toContain("Unlock this next");
    expect(goals).toContain("Best next unlock");
    expect(goals).toContain("Start:");
    expect(goals).toContain("Stop:");
    expect(goals).toContain("Make this my route");
    expect(goals).toContain("Why this unlock?");
    expect(goals).toContain("Browse other unlocks");
    expect(goals).not.toContain("rewards found");
    expect(goals.indexOf("<NextUnlockCompanion")).toBeLessThan(goals.indexOf("Browse other unlocks"));
  });

  it("keeps a chosen unlock ahead of unrelated /next trips", () => {
    const next = read("src/app/next/next-client.tsx");

    expect(next).toContain("function goalRouteFocusFromSearch");
    expect(next).toContain("function recommendationForGoalRoute");
    expect(next).toContain("You chose this reward in Unlocks");
    expect(next).toContain("score: 10_000");
    expect(next).toContain('routeTags: ["unlock"]');
  });

  it("makes Slayer start from one task trip before the master evidence", () => {
    const slayer = read("src/app/slayer/slayer-client.tsx");

    expect(slayer).toContain("function SlayerTaskRoute");
    expect(slayer).toContain('label="Start"');
    expect(slayer).toContain('label="Bring"');
    expect(slayer).toContain('label="Stop at"');
    expect(slayer).toContain('label="Points"');
    expect(slayer).toContain("Compare Slayer masters");
    expect(slayer).toContain("Only when you need a new assignment.");
    expect(slayer.indexOf("<SlayerTaskRoute")).toBeLessThan(slayer.indexOf("<ScapestackReadinessRail"));
    expect(slayer).not.toContain("Best master for you");
    expect(slayer).not.toContain("Sorted op expected XP/uur");
    expect(slayer).not.toContain("Plugin sync live");
    expect(slayer).not.toContain("Master choices and blocks");
    expect(slayer).not.toContain("item id ${item.id}");
  });
});
