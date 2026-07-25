import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { nextUpLineCount, nextUpSourceFiles } from "./helpers/next-up-source";

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
    expect(lineCount("src/components/bank-result.tsx")).toBeLessThanOrEqual(6_050);
  });

  it("keeps the /next engine split into modules instead of one monolith", () => {
    // next-up.ts was a single 3.9k-line file. The cap is per-module now, so
    // new content has to land in (or create) a focused module rather than
    // growing the entry point back into a monolith. Total engine size is
    // capped separately so a split can't become an excuse for sprawl.
    for (const file of nextUpSourceFiles()) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/).length;
      expect(lines, file).toBeLessThanOrEqual(1_600);
    }
    // Raised from 4,200 when content-access gating landed on money, bosses,
    // minigames and diaries. Growth from new behaviour is fine; the per-module
    // cap above is what actually prevents a monolith returning.
    expect(nextUpLineCount()).toBeLessThanOrEqual(4_600);
  });

  it("keeps the engine entry point free of recommendation-source data", () => {
    const entry = source("src/lib/next-up.ts");
    expect(entry).toContain('from "./next-up-types"');
    expect(entry).not.toContain("const MONEY_METHODS");
    expect(entry).not.toContain("const MINIGAMES");
    expect(entry).not.toContain("function rankRecommendations");
  });
});
