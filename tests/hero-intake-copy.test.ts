import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/hero-intake.tsx"), "utf8");

describe("hero intake copy and routing", () => {
  it("marks RSN-only homepage runs as bankless to avoid stale session bank context", () => {
    expect(source).toContain("const hasBankPaste = showBank && Boolean(bank.trim())");
    expect(source).toContain('router.push(`/next?rsn=${encodeURIComponent(trimmed)}${hasBankPaste ? "" : "&bank=none"}`)');
  });

  it("labels homepage actions by data source instead of generic generation", () => {
    expect(source).toContain('hasBankPaste ? "Plan with bank" : "Plan from stats"');
    expect(source).toContain('aria-label={hasBankPaste ? "Open /next planner with RSN and browser-only bank paste" : "Open /next planner with RSN and Hiscores only"}');
    expect(source).toContain("Add browser-only bank paste");
    expect(source).toContain("browser-only, sharper gear advice");
  });

  it("explains why the hero planner CTA is disabled", () => {
    expect(source).toContain('aria-describedby="hero-plan-disabled-help"');
    expect(source).toContain('id="hero-plan-disabled-help"');
    expect(source).toContain("Type an OSRS name to unlock the planner.");
    expect(source).toContain("ignore stale bank handoff data");
  });

  it("labels the homepage RSN input as a real OSRS-name field", () => {
    expect(source).toContain('htmlFor="hero-rsn-input"');
    expect(source).toContain("OSRS name for /next planning");
    expect(source).toContain('id="hero-rsn-input"');
    expect(source).toContain('name="rsn"');
    expect(source).toContain('autoComplete="off"');
    expect(source).toContain("spellCheck={false}");
  });

  it("treats optional bank paste as an explicit browser-only control", () => {
    expect(source).toContain('const HERO_BANK_PANEL_ID = "hero-bank-paste-panel";');
    expect(source).toContain('const HERO_BANK_TEXTAREA_ID = "hero-bank-paste";');
    expect(source).toContain('const HERO_BANK_HELP_ID = "hero-bank-paste-help";');
    expect(source).toContain("aria-controls={HERO_BANK_PANEL_ID}");
    expect(source).toContain("aria-expanded={showBank}");
    expect(source).toContain('aria-label="Show optional browser-only bank paste field"');
    expect(source).toContain('role="region"');
    expect(source).toContain('aria-label="Optional browser-only bank paste"');
    expect(source).toContain('name="bank"');
    expect(source).toContain("aria-labelledby={`${HERO_BANK_TEXTAREA_ID}-label`}");
    expect(source).toContain("aria-describedby={HERO_BANK_HELP_ID}");
    expect(source).toContain("Bank paste detected. It stays in this browser session and is consumed by /next.");
    expect(source).toContain("RuneLite sync never receives this bank.");
    expect(source).toContain('aria-label="Hide bank paste and plan from Hiscores only"');
  });
});
