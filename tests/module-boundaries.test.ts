import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function lineCount(path: string): number {
  return source(path).split(/\r?\n/).length;
}

describe("module boundaries", () => {
  it("keeps plan-surface logic out of the /next client monolith", () => {
    const nextClient = source("src/app/next/next-client.tsx");
    const planSurface = source("src/lib/next-plan-surface.ts");

    expect(nextClient).toContain('from "@/lib/next-plan-surface"');
    expect(nextClient).not.toContain('from "@/lib/banked-xp"');
    expect(nextClient).not.toContain("function makePlanSmarterCopy");
    expect(nextClient).not.toContain("function skillingBankSummaryForRecommendation");
    expect(planSurface).toContain("export function makePlanSmarterCopy");
    expect(planSurface).toContain("export function skillingBankSummaryForSkill");
  });

  it("sets size guardrails around the current large product files", () => {
    expect(lineCount("src/app/next/next-client.tsx")).toBeLessThanOrEqual(5_900);
    expect(lineCount("src/lib/next-up.ts")).toBeLessThanOrEqual(3_900);
    expect(lineCount("src/components/bank-result.tsx")).toBeLessThanOrEqual(6_050);
  });
});
