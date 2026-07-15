import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("ready to leave UX", () => {
  it("keeps the shared trip check small and OSRS-actionable", () => {
    const component = read("src/components/ready-to-leave.tsx");

    expect(component).toContain("ReadyToLeaveStatus");
    expect(component).toContain('"Good first trip"');
    expect(component).toContain('"Worth doing"');
    expect(component).toContain('"Good AFK loop"');
    expect(component).toContain('"Bank first"');
    expect(component).toContain('"Bring food"');
    expect(component).toContain('"Pick a teleport"');
    expect(component).toContain('"Skip for now"');
    expect(component).toContain('"Unlock first"');
    expect(component).toContain('"Check items"');
    expect(component).toContain('"Gear"');
    expect(component).toContain('"Bank"');
    expect(component).toContain('"Start"');
    expect(component).toContain('"Need"');
    expect(component).toContain('"Stop"');
    expect(component).toContain('"Train"');
    expect(component).toContain('"Cash out"');
    expect(component).toContain('"Task"');
    expect(component).toContain('"Stop at"');
    expect(component).toContain('"mt-3 bg-transparent"');
    expect(component).toContain("displayLabel");
    expect(component).toContain("divide-y divide-[var(--color-border)]/45");
    expect(component).toContain("ArrowRight");
    expect(component).not.toContain('"grid gap-x-4 gap-y-2 sm:grid-cols-4"');
    expect(component).not.toContain('"min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)]/45 px-2.5 py-2"');
    expect(component).not.toContain('"Ready to leave"');
    expect(component).not.toContain('"Missing food"');
    expect(component).not.toContain('"Gear looks weak"');
    expect(component).not.toContain('"Add bank first"');
    expect(component).not.toContain("dashboard");
    expect(component).not.toContain("signals");
    expect(component).not.toContain("payload");
    expect(component).not.toContain("readiness panel");
  });

  it("keeps /next simple and makes Bank use its own player prompts", () => {
    expect(read("src/app/next/next-client.tsx")).not.toContain("<ReadyToLeave status={readyToLeave.status} items={readyToLeave.items}");
    expect(read("src/app/next/next-client.tsx")).toContain("Start here");
    expect(read("src/components/bank-result.tsx")).not.toContain("<ReadyToLeave status={readiness.status} items={readiness.items} compact");
    expect(read("src/components/bank-result.tsx")).toContain("RuneLite setup steps");
    expect(read("src/components/bank-result.tsx")).toContain("First");
    expect(read("src/components/bank-result.tsx")).toContain("Leave");
    expect(read("src/app/dps/dps-client.tsx")).not.toContain("ReadyToLeave");
    expect(read("src/app/dps/dps-client.tsx")).toContain("Pick a boss");
    expect(read("src/app/dps/dps-client.tsx")).toContain("Search any boss. Click a tile for gear, supplies, upgrades and a first trip.");
  });
});
