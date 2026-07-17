import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe("trip flow contract", () => {
  it("keeps mobile content clear of the fixed action bar", () => {
    const layout = read("src/app/layout.tsx");
    const mobileBar = read("src/components/mobile-action-bar.tsx");

    expect(layout).toContain("pb-24 sm:pb-0");
    expect(mobileBar).toContain('label: "Trip"');
    expect(mobileBar).toContain('helper: rsn || "Trip"');
    expect(mobileBar).toContain('active: pathname === "/next"');
    expect(mobileBar).not.toContain('label: "Plan"');
  });

  it("makes Goals start from one unlock trip before showing more routes", () => {
    const goals = read("src/app/goals/goals-client.tsx");

    expect(goals).toContain("Next unlock trip");
    expect(goals).toContain("Before you leave");
    expect(goals).toContain("Still missing");
    expect(goals).toContain("Finish after");
    expect(goals).toContain("Open Wiki route");
    expect(goals).toContain("Why this unlock?");
    expect(goals).toContain("More unlock routes");
    expect(goals).not.toContain("Pick a reward");
    expect(goals).not.toContain("Good rewards to chase");
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
