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
    expect(mobileBar).toContain('selected: pathname === "/next" || pathname.startsWith("/p/")');
    expect(mobileBar).toContain("complete: hasBank");
    expect(mobileBar).not.toContain("action.helper");
    expect(mobileBar).not.toContain('label: "Plan"');
  });

  it("makes Goals start from one unlock trip before showing more routes", () => {
    const goals = read("src/app/goals/goals-client.tsx");

    expect(goals).toContain("Unlock this next");
    expect(goals).toContain("Best next unlock");
    // Was `toContain("Start:")` / `toContain("Stop:")`. Direction B moved the
    // pair into the shared measure/value table, so the labels are real row
    // headers now — which is what makes a screen reader announce "Stop, after
    // the set changes" instead of two loose sentences. The thing this case
    // guards, that the companion states where to begin and where to stop
    // before it shows anything else, is unchanged.
    expect(goals).toContain('<th scope="row" className="w-[64px]">Start</th>');
    expect(goals).toContain('<th scope="row">Stop</th>');
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
    // The four route lines were an icon-plus-label list; each icon restated
    // the word beside it. Direction B made them rows of the shared table, so
    // the labels are row headers rather than props on a RouteLine component.
    // Same four facts, same order, one fewer component.
    expect(slayer).toContain('<th scope="row" className="w-[112px]">Start</th>');
    expect(slayer).toContain('<th scope="row">Bring</th>');
    expect(slayer).toContain('<th scope="row">Stop at</th>');
    expect(slayer).toContain('<th scope="row">Points</th>');
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
