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
    expect(component).toContain('"Ready to leave"');
    expect(component).toContain('"Missing food"');
    expect(component).toContain('"Missing teleport"');
    expect(component).toContain('"Gear looks weak"');
    expect(component).toContain('"Add gear first"');
    expect(component).toContain('"Gear" | "Food" | "Teleport" | "Stop point"');
    expect(component).not.toContain("dashboard");
    expect(component).not.toContain("signals");
    expect(component).not.toContain("payload");
    expect(component).not.toContain("readiness panel");
  });

  it("uses the shared trip check on /next, Bank and DPS", () => {
    expect(read("src/app/next/next-client.tsx")).toContain("<ReadyToLeave status={readyToLeave.status} items={readyToLeave.items}");
    expect(read("src/components/bank-result.tsx")).toContain("<ReadyToLeave status={readiness.status} items={readiness.items} compact");
    expect(read("src/app/dps/dps-client.tsx")).toContain("<ReadyToLeave status={readiness.status} items={readiness.items} compact");
  });
});
