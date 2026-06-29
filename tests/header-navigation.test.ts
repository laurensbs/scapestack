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
    expect(source).toContain("AccountSwitcher");
    expect(source).toContain("Add RSN");
    expect(source).toContain("Setup added");
    expect(source).toContain("Add setup");
    expect(source).toContain("Check RuneLite");
    expect(source).toContain("Remove account");
    expect(source).toContain("Remove ${rsn} from Scapestack on this device?");
    expect(source).toContain("<Package");
    expect(source).toContain("<PlugZap");
  });

  it("surfaces the core Do now → Gear → RuneLite loop as clickable navigation", () => {
    expect(source).toContain("LOOP_STEPS");
    expect(source).toContain('const LOOP_LABEL = "Start with one trip. Gear and RuneLite stay optional."');
    expect(source).toContain('aria-label="Pick the next OSRS trip"');
    expect(source).toContain('href={contextualNavHref("/next", pathname, contextQuery, activeRsn)}');
    expect(source).toContain("Start with one trip");
    expect(source).toContain("Open the plan first. Add gear or RuneLite only when it changes the trip.");
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
