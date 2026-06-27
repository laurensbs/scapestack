import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/scapestack-command-system.tsx"), "utf8");

describe("Scapestack command system UI", () => {
  it("renders player prompts with explicit affordances", () => {
    expect(source).toContain("BRAND_UI_SURFACES");
    expect(source).toContain("BRAND_PLAYER_PROMPTS");
    expect(source).toContain("Next moves");
    expect(source).toContain("Tell Scapestack what you feel like doing.");
    expect(source).toContain('aria-label="OSRS login prompts"');
    expect(source).toContain("PROMPT_ICONS");
    expect(source).toContain("aria-label={`${surface.page}: ${surface.primaryAction}`}");
    expect(source).toContain("focus-visible:border-[var(--color-accent)]/65");
    expect(source).toContain("group-hover/surface:translate-x-0.5");
    expect(source).not.toContain("A PvM prep room, not a SaaS dashboard.");
    expect(source).not.toContain("Voice contract");
  });

  it("keeps the visible card set about OSRS choices instead of UI states", () => {
    expect(source).toContain("Tonight");
    expect(source).toContain("Boss");
    expect(source).toContain("Slayer");
    expect(source).toContain("Unlocks");
    expect(source).not.toContain('aria-label="Scapestack state system"');
    expect(source).not.toContain("STATE_ACCENTS");
  });
});
