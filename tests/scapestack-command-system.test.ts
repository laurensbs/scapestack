import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/scapestack-command-system.tsx"), "utf8");

describe("Scapestack command system UI", () => {
  it("renders the product as a PvM prep room with explicit affordances", () => {
    expect(source).toContain("BRAND_UI_SURFACES");
    expect(source).toContain("BRAND_STATE_SYSTEM");
    expect(source).toContain("BRAND_VOICE_RULES");
    expect(source).toContain("A PvM prep room, not a SaaS dashboard.");
    expect(source).toContain("what data was used");
    expect(source).toContain("aria-label={`${surface.page}: ${surface.primaryAction}`}");
    expect(source).toContain("focus-visible:border-[var(--color-accent)]/65");
    expect(source).toContain("group-hover/surface:translate-x-0.5");
  });

  it("keeps page states visible instead of hidden in generic errors", () => {
    expect(source).toContain('aria-label="Scapestack state system"');
    expect(source).toContain("STATE_ACCENTS");
    expect(source).toContain("Empty");
    expect(source).toContain("Loading");
    expect(source).toContain("Error");
    expect(source).toContain("Mobile");
  });
});
