import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/components/header.tsx"), "utf8");

describe("global header navigation", () => {
  it("marks Scapestack brand and primary tools with explicit navigation labels", () => {
    expect(source).toContain('aria-label="Scapestack home"');
    expect(source).toContain('aria-label="Primary Scapestack tools"');
    expect(source).toContain('aria-label={`${tool.navLabel ?? tool.name}: ${tool.short}`}');
    expect(source).toContain('aria-current={active ? "page" : undefined}');
  });

  it("surfaces the core Next → Gear → Sync loop as clickable navigation", () => {
    expect(source).toContain("LOOP_STEPS");
    expect(source).toContain('const LOOP_LABEL = "Pick the next trip: Next → Gear → RuneLite"');
    expect(source).toContain('aria-label="Pick the next OSRS trip"');
    expect(source).toContain('href={contextualNavHref("/next", pathname, contextQuery)}');
    expect(source).toContain("Pick the next trip");
    expect(source).toContain("Start with one trip. Add gear or RuneLite only when it changes the route.");
    expect(source).toContain('aria-label={`${step.label} in Scapestack loop`}');
  });

  it("connects the mobile menu button to the mobile drawer state", () => {
    expect(source).toContain('const mobileNavId = "scapestack-mobile-nav"');
    expect(source).toContain("aria-controls={mobileNavId}");
    expect(source).toContain("aria-expanded={mobileOpen}");
    expect(source).toContain('aria-label="Mobile Scapestack tools"');
    expect(source).toContain("id={mobileNavId}");
  });
});
