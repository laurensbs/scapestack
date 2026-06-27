import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/scapestack-command-system.tsx"), "utf8");

describe("Scapestack command system UI", () => {
  it("renders player prompts with explicit affordances", () => {
    expect(source).toContain("BRAND_PLAYER_PROMPTS");
    expect(source).toContain("PLAYER_VIBE_PROMPTS");
    expect(source).toContain("Session vibe");
    expect(source).toContain("Pick the kind of session you want.");
    expect(source).toContain('aria-label="OSRS session vibe prompts"');
    expect(source).toContain("PROMPT_ICONS");
    expect(source).toContain("focus-visible:border-[var(--color-accent)]/65");
    expect(source).toContain("group-hover/prompt:translate-x-0.5");
    expect(source).not.toContain("BRAND_UI_SURFACES");
    expect(source).not.toContain("Tell Scapestack what you feel like doing.");
    expect(source).not.toContain("A PvM prep room, not a SaaS dashboard.");
    expect(source).not.toContain("Voice contract");
  });

  it("keeps the visible card set about session mood instead of app surfaces", () => {
    expect(source).toContain("Same account, different mood.");
    expect(source).toContain("Let /next bias the plan without turning this into setup.");
    expect(source).toContain("BRAND_PLAYER_PROMPTS.slice(0, 6)");
    expect(source).not.toContain("SURFACE_LINKS");
    expect(source).not.toContain("surface.primaryAction");
    expect(source).not.toContain("surface.requiredFeeling");
    expect(source).not.toContain('aria-label="Scapestack state system"');
    expect(source).not.toContain("STATE_ACCENTS");
  });
});
