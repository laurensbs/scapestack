import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/hero-intake.tsx"), "utf8");

describe("hero intake copy and routing", () => {
  it("marks RSN-only homepage runs as bankless while allowing bank-only starts", () => {
    expect(source).toContain("const hasBankPaste = showBank && Boolean(bank.trim())");
    expect(source).toContain("const canSubmit = Boolean(rsn.trim() || hasBankPaste)");
    expect(source).toContain('if (!hasBankPaste) params.set("bank", "none");');
    expect(source).toContain("router.push(`/next?${params.toString()}`)");
  });

  it("uses the three homepage CTAs requested by the product prompt", () => {
    expect(source).toContain("Plan my next move");
    expect(source).toContain("Add gear");
    expect(source).toContain("RuneLite later");
    expect(source).toContain('href="/plugin#verify-sync"');
    expect(source).toContain("Plan my next move with this gear");
    expect(source).toContain("Gear paste");
  });

  it("explains why the hero planner CTA is disabled", () => {
    expect(source).toContain('aria-describedby="hero-plan-disabled-help"');
    expect(source).toContain('id="hero-plan-disabled-help"');
    expect(source).toContain("Enter an OSRS name to get one clear next move.");
    expect(source).toContain("Add a name for stats and KC.");
    expect(source).toContain("public stats are enough to start");
  });

  it("labels the homepage RSN input as a real OSRS-name field", () => {
    expect(source).toContain('htmlFor="hero-rsn-input"');
    expect(source).toContain("OSRS name for /next planning");
    expect(source).toContain('id="hero-rsn-input"');
    expect(source).toContain('name="rsn"');
    expect(source).toContain('autoComplete="off"');
    expect(source).toContain("spellCheck={false}");
  });

  it("treats optional bank paste as an explicit gear-context control", () => {
    expect(source).toContain('const HERO_BANK_PANEL_ID = "hero-bank-paste-panel";');
    expect(source).toContain('const HERO_BANK_TEXTAREA_ID = "hero-bank-paste";');
    expect(source).toContain('const HERO_BANK_HELP_ID = "hero-bank-paste-help";');
    expect(source).toContain("aria-controls={HERO_BANK_PANEL_ID}");
    expect(source).toContain("aria-expanded={showBank}");
    expect(source).toContain('aria-label="Show optional gear paste field"');
    expect(source).toContain('role="region"');
    expect(source).toContain('aria-label="Optional bank paste"');
    expect(source).toContain('name="bank"');
    expect(source).toContain("aria-labelledby={`${HERO_BANK_TEXTAREA_ID}-label`}");
    expect(source).toContain("aria-describedby={HERO_BANK_HELP_ID}");
    expect(source).toContain("Gear added. Supplies and GP can shape the plan.");
    expect(source).toContain("Optional: add gear when supplies or GP matters.");
    expect(source).toContain('aria-label="Hide gear paste and plan from public stats only"');
  });
});
