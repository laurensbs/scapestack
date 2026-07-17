import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/bank-setup-steps.tsx"), "utf8");

describe("shared bank setup screenshots", () => {
  it("keeps the Bank Memory screenshots reusable across bank entry points", () => {
    expect(source).toContain("export const BANK_SETUP_STEPS");
    expect(source).toContain('src: "/intro/step1.png"');
    expect(source).toContain('src: "/intro/step2.png"');
    expect(source).toContain("RuneLite Plugin Hub -> Bank Memory.");
    expect(source).toContain("Right-click your saved bank and copy item data.");
    expect(source).toContain("export function BankSetupSteps");
    expect(source).toContain("BANK_MEMORY_EXAMPLE");
    expect(source).toContain('export const BANK_MEMORY_EXAMPLE = "/intro/step2.png";');
    expect(source).toContain("showBankExample");
    expect(source).toContain("Your bank in RuneLite");
  });
});
